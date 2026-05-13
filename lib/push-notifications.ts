import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { api } from "@/lib/api";
import { displayIncomingCall } from "@/lib/callkeep-setup";

const EAS_PROJECT_ID = "86d256ec-943f-49e8-adaf-659400e4edac";

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
      displayIncomingCall(
        data.callSessionId,
        data.callerName ?? "Incoming call",
        data.mode === "VIDEO",
      );
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
    sound: "default",
  });
  await Notifications.setNotificationChannelAsync("questions", {
    name: "Question Updates",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#3B82F6",
  });
  await Notifications.setNotificationChannelAsync("calls", {
    name: "Incoming Calls",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500],
    lightColor: "#22c55e",
    enableLights: true,
    enableVibrate: true,
    sound: "default",
  });
  await Notifications.setNotificationChannelAsync("wallet", {
    name: "Wallet & Payments",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: "#F59E0B",
  });
  await Notifications.setNotificationChannelAsync("default", {
    name: "General",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#3B82F6",
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
    return null;
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
      return String(deviceToken.data);
    }
    console.warn("[push] No push token obtained at all");
    return null;
  }

  console.log("[push] Expo push token obtained:", tokenData.data.slice(0, 30) + "…");
  return tokenData.data;
}

export async function subscribePushToken(token: string): Promise<boolean> {
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
  } catch {
    return false;
  }
}

export async function unsubscribePushToken(token: string): Promise<boolean> {
  try {
    await api.post("/push/unsubscribe", { endpoint: token });
    return true;
  } catch {
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
