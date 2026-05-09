import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { api } from "@/lib/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#4F46E5",
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: undefined,
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
