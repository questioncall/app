import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

let foregroundHandlerConfigured = false;
let permissionRequested = false;

async function ensurePermission(): Promise<boolean> {
  if (!permissionRequested) {
    permissionRequested = true;
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  }
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

function configureForegroundHandler() {
  if (foregroundHandlerConfigured) return;
  foregroundHandlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === "android") {
    void Notifications.setNotificationChannelAsync("answer-deadline", {
      name: "Answer deadline reminders",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

/**
 * Schedule a one-shot local notification at `fireAt`.
 * Returns the scheduled identifier (or null if permission denied / already past).
 */
export async function scheduleLocalNotification(opts: {
  title: string;
  body: string;
  fireAt: Date;
  data?: Record<string, unknown>;
  channelId?: string;
}): Promise<string | null> {
  configureForegroundHandler();

  const granted = await ensurePermission();
  if (!granted) return null;

  const seconds = Math.floor((opts.fireAt.getTime() - Date.now()) / 1000);
  if (seconds <= 0) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: opts.title,
      body: opts.body,
      data: opts.data ?? {},
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: opts.channelId ?? "answer-deadline",
    },
  });
}

export async function cancelLocalNotification(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // best-effort
  }
}

/**
 * Schedule the T-60s reminder for an accepted question.
 * Used by the teacher feed Accept flow.
 */
export async function scheduleAnswerDeadlineReminder(opts: {
  questionTitle: string;
  channelId: string;
  timerDeadline: string;
  leadSeconds?: number;
}): Promise<string | null> {
  const deadline = new Date(opts.timerDeadline);
  if (Number.isNaN(deadline.getTime())) return null;

  const lead = opts.leadSeconds ?? 60;
  const fireAt = new Date(deadline.getTime() - lead * 1000);

  return scheduleLocalNotification({
    title: "Answer deadline approaching",
    body: `1 minute left to answer "${opts.questionTitle}"`,
    fireAt,
    data: { channelId: opts.channelId, kind: "answer-deadline" },
  });
}
