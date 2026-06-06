import { Platform, Alert, Linking } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { api } from "@/lib/api";
import { displayIncomingCall, incomingCallMetadataMap } from "@/lib/callkeep-setup";
import { showFullScreenCallNotification } from "@/lib/full-screen-call-notification";

const EAS_PROJECT_ID = "86d256ec-943f-49e8-adaf-659400e4edac";

let currentPushToken: string | null = null;

/**
 * Returns the last registered push token so callers (e.g. logout flows)
 * can unsubscribe it from the server without re-registering.
 */
export function getCurrentPushToken(): string | null {
  return currentPushToken;
}

/**
 * Single, unified notification handler.
 *
 * • Incoming-call pushes (identified by `callSessionId` in data) are routed
 *   to the native call UI via CallKeep and suppressed from the banner.
 * • Every other notification is shown normally as a banner/alert.
 *
 * IMPORTANT: Do NOT call `setNotificationHandler` anywhere else — doing so
 * would overwrite this handler and lose the call-specific routing.
 */
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as Record<string, string> | undefined;

    // Incoming call → show native call screen instead of a push banner
    if (data?.callSessionId) {
      const mode: "AUDIO" | "VIDEO" = data.mode === "VIDEO" ? "VIDEO" : "AUDIO";
      const callerName = data.callerName ?? "Incoming call";
      // Cache metadata so the native answer event can recover the mode/callerId
      // (the answer event only delivers a callUUID).
      incomingCallMetadataMap.set(data.callSessionId, {
        mode,
        callerId: String(data.callerId ?? ""),
        channelId: String(data.channelId ?? ""),
        callerName,
      });
      displayIncomingCall(data.callSessionId, callerName, mode === "VIDEO");
      showFullScreenCallNotification(data.callSessionId, callerName, mode === "VIDEO");
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    // All other notifications — show alert, sound, badge
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

async function setupAndroidChannels() {
  await Notifications.setNotificationChannelAsync("chat", {
    name: "Chat Messages",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#3B82F6",
    sound: "notification_sound",
  });
  await Notifications.setNotificationChannelAsync("questions", {
    name: "Question Updates",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#3B82F6",
    sound: "notification_sound",
  });
  await Notifications.setNotificationChannelAsync("calls", {
    name: "Incoming Calls",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500],
    lightColor: "#22c55e",
    enableLights: true,
    enableVibrate: true,
    sound: "notification_sound",
  });
  await Notifications.setNotificationChannelAsync("wallet", {
    name: "Wallet & Payments",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: "#F59E0B",
    sound: "notification_sound",
  });
  await Notifications.setNotificationChannelAsync("default", {
    name: "General",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#3B82F6",
    sound: "notification_sound",
  });
}

/** Show an alert directing the user to system settings to enable notifications manually. */
async function showSettingsAlert(): Promise<void> {
  await new Promise<void>((resolve) => {
    Alert.alert(
      "Enable Notifications",
      "To receive question updates, chat messages, and call alerts, please enable notifications in your device settings.\n\nSettings → Apps → QuestionCall → Notifications",
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve() },
        {
          text: "Open Settings",
          onPress: () => {
            Linking.openSettings();
            resolve();
          },
        },
      ],
    );
  });
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("[push] Not a physical device — skipping push registration");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("[push] Notification permission not granted:", finalStatus);

    // Check if we can ask again (Android 13+ may block re-prompting)
    const perm = await Notifications.getPermissionsAsync();
    const canAskAgain = perm.canAskAgain ?? true;

    if (!canAskAgain) {
      // Permanently denied — guide user to system settings
      await showSettingsAlert();
      return null;
    }

    // Denied but we can still re-prompt — explain why notifications matter
    let shouldRetry = false;
    await new Promise<void>((resolve) => {
      Alert.alert(
        "Notifications Needed",
        "QuestionCall needs notification permission to alert you when you receive answers, chat messages, and incoming calls.",
        [
          {
            text: "Not Now",
            style: "cancel",
            onPress: () => resolve(),
          },
          {
            text: "Try Again",
            onPress: () => {
              shouldRetry = true;
              resolve();
            },
          },
        ],
      );
    });

    if (shouldRetry) {
      const { status: retryStatus } = await Notifications.requestPermissionsAsync();
      if (retryStatus !== "granted") {
        console.warn("[push] Permission still denied after re-prompt:", retryStatus);
        // Still denied after retry — guide user to settings
        await showSettingsAlert();
        return null;
      }
    } else {
      // User chose "Not Now" — stop
      return null;
    }
  }

  if (Platform.OS === "android") {
    await setupAndroidChannels();
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: EAS_PROJECT_ID,
  }).catch((err) => {
    console.warn("[push] getExpoPushTokenAsync failed:", err?.message ?? err);
    return null;
  });

  if (!tokenData) {
    console.warn("[push] No Expo push token, trying device token fallback");
    const deviceToken = await Notifications.getDevicePushTokenAsync().catch((err) => {
      console.warn("[push] getDevicePushTokenAsync failed:", err?.message ?? err);
      return null;
    });
    if (deviceToken?.data) {
      console.log("[push] Using device push token (FCM)");
      currentPushToken = String(deviceToken.data);
      return currentPushToken;
    }
    console.warn("[push] No push token obtained at all");
    return null;
  }

  console.log("[push] Expo push token obtained:", tokenData.data.slice(0, 30) + "…");
  currentPushToken = tokenData.data;
  return tokenData.data;
}

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function subscribePushToken(token: string): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await api.post("/push/subscribe", {
        subscription: {
          endpoint: token,
          expirationTime: null,
          keys: {},
          platform: Platform.OS === "ios" ? "ios" : "android",
        },
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[push] Failed to subscribe push token (attempt ${attempt}/${MAX_RETRIES}):`,
        message,
      );
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[push] Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  return false;
}

export async function unsubscribePushToken(token: string): Promise<boolean> {
  try {
    await api.post("/push/unsubscribe", { endpoint: token });
    return true;
  } catch (error) {
    // Best-effort cleanup — never surface this. In dev, console.error is
    // elevated to a red error overlay, and an unsubscribe failure during
    // sign-out / account deletion (token already gone → 401) is harmless.
    console.warn(
      "[push] Failed to unsubscribe push token:",
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}

export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void,
) {
  return Notifications.addNotificationReceivedListener(handler);
}

/**
 * No-op — the unified handler is now set at module scope and must not be
 * overwritten. Kept as an export so existing call-sites don't break.
 *
 * @deprecated The module-level handler already shows alerts for all
 * non-call notifications. Do not call `setNotificationHandler` again.
 */
export async function configureNotificationHandler() {
  // Intentionally empty — handler is already configured at module load.
}
