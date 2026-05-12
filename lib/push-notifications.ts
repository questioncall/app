import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { api } from "@/lib/api";
import { displayIncomingCall } from "@/lib/callkeep-setup";

const EAS_PROJECT_ID = "86d256ec-943f-49e8-adaf-659400e4edac";

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
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  if (Platform.OS === "android") {
    await setupAndroidChannels();
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: EAS_PROJECT_ID,
  }).catch(() => null);

  if (!tokenData) {
    const deviceToken = await Notifications.getDevicePushTokenAsync().catch(() => null);
    if (deviceToken?.data) {
      return String(deviceToken.data);
    }
    return null;
  }

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
 * Configure notification handler to always show alerts even when app is in foreground.
 * This ensures notifications appear globally outside the app as well.
 */
export async function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
