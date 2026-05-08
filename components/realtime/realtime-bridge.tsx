import { useEffect } from "react";
import { AppState } from "react-native";
import Toast from "react-native-toast-message";

import {
  CHANNEL_UPDATED_EVENT,
  NEW_CHANNEL_EVENT,
  NOTIFICATION_EVENT,
  SUBSCRIPTION_UPDATED_EVENT,
  getPusherClient,
  getPusherConfig,
  getUserPusherName,
  resetPusherClient,
} from "@/lib/realtime";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  addRealtimeNotification,
  clearRealtime,
  setRealtimeReconnectAttempts,
  setRealtimeStatus,
  setRealtimeUserChannel,
} from "@/store/slices/realtimeSlice";
import { updateChannelLastMessage, upsertChannel } from "@/store/slices/channelsSlice";
import { updateUser } from "@/store/slices/userSlice";

type ChannelUpdatedPayload = {
  channelId: string;
  unreadCountCleared?: boolean;
  unreadCountIncrement?: number;
  lastMessagePreview?: string;
  lastMessageAt?: string;
};

export function RealtimeBridge() {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((s) => s.user.data?._id ?? null);

  useEffect(() => {
    if (!userId) {
      resetPusherClient();
      dispatch(clearRealtime());
      return;
    }

    const config = getPusherConfig();
    if (!config) {
      dispatch(
        setRealtimeStatus({
          status: "unavailable",
          error: "Pusher keys are not configured for the mobile app.",
        }),
      );
      return;
    }

    const client = getPusherClient();
    if (!client) return;

    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const channelName = getUserPusherName(userId);
    dispatch(setRealtimeUserChannel(channelName));

    const clearReconnectTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = (error?: string) => {
      if (disposed) return;
      clearReconnectTimer();
      attempts += 1;
      dispatch(setRealtimeReconnectAttempts(attempts));
      dispatch(
        setRealtimeStatus({
          status: error ? "error" : "disconnected",
          error: error ?? null,
        }),
      );

      const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempts, 5));
      reconnectTimer = setTimeout(() => {
        if (disposed) return;
        dispatch(setRealtimeStatus({ status: "connecting" }));
        client.connect();
      }, delay);
    };

    const channel = client.subscribe(channelName);

    channel.bind(NOTIFICATION_EVENT, (payload: any) => {
      const notification = payload?.notification ?? payload;
      if (!notification?.id && !notification?._id) return;

      dispatch(
        addRealtimeNotification({
          id: String(notification.id ?? notification._id),
          type: String(notification.type ?? "notification"),
          message: String(notification.message ?? "New notification"),
          href: notification.href ?? null,
          isRead: Boolean(notification.isRead),
          createdAt: notification.createdAt,
        }),
      );
      Toast.show({
        type: "info",
        text1: "New notification",
        text2: String(notification.message ?? ""),
      });
    });

    channel.bind(NEW_CHANNEL_EVENT, (payload: any) => {
      if (payload?.channel?._id) {
        dispatch(upsertChannel(payload.channel));
      }
    });

    channel.bind(CHANNEL_UPDATED_EVENT, (payload: ChannelUpdatedPayload) => {
      if (!payload?.channelId) return;

      dispatch(
        updateChannelLastMessage({
          channelId: payload.channelId,
          lastMessage:
            payload.lastMessagePreview && payload.lastMessageAt
              ? {
                  content: payload.lastMessagePreview,
                  senderId: "",
                  createdAt: payload.lastMessageAt,
                }
              : undefined,
          unreadCount: payload.unreadCountCleared ? 0 : payload.unreadCountIncrement,
        }),
      );
    });

    channel.bind(SUBSCRIPTION_UPDATED_EVENT, (payload: any) => {
      dispatch(
        updateUser({
          subscriptionStatus: payload.subscriptionStatus,
          subscriptionEnd: payload.subscriptionEnd,
          planSlug: payload.planSlug,
          ...(payload.questionsAsked !== undefined
            ? { questionsAsked: payload.questionsAsked }
            : {}),
        }),
      );
    });

    client.connection.bind("connected", () => {
      attempts = 0;
      clearReconnectTimer();
      dispatch(setRealtimeStatus({ status: "connected" }));
    });
    client.connection.bind("disconnected", () => scheduleReconnect());
    client.connection.bind("unavailable", () =>
      scheduleReconnect("Realtime connection unavailable."),
    );
    client.connection.bind("error", (error: any) =>
      scheduleReconnect(error?.message ?? "Realtime connection error."),
    );

    dispatch(setRealtimeStatus({ status: "connecting" }));
    client.connect();

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        clearReconnectTimer();
        dispatch(setRealtimeStatus({ status: "connecting" }));
        client.connect();
      }
    });

    return () => {
      disposed = true;
      clearReconnectTimer();
      appStateSubscription.remove();
      channel.unbind_all();
      client.unsubscribe(channelName);
      client.connection.unbind("connected");
      client.connection.unbind("disconnected");
      client.connection.unbind("unavailable");
      client.connection.unbind("error");
    };
  }, [dispatch, userId]);

  return null;
}
