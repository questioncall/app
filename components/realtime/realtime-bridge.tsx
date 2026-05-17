import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import Toast from "react-native-toast-message";

import {
  CHANNEL_UPDATED_EVENT,
  NEW_CHANNEL_EVENT,
  NOTIFICATION_EVENT,
  SUBSCRIPTION_UPDATED_EVENT,
  CALL_INCOMING_EVENT,
  CALL_CANCELLED_EVENT,
  CALL_MISSED_EVENT,
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
import {
  displayIncomingCall,
  endCallKeepCall,
  incomingCallMetadataMap,
} from "@/lib/callkeep-setup";
import {
  showFullScreenCallNotification,
  hideFullScreenCallNotification,
} from "@/lib/full-screen-call-notification";

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
  const activeChannelId = useAppSelector((s) => s.channels.activeChannelId);
  const activeChannelIdRef = useRef(activeChannelId);
  activeChannelIdRef.current = activeChannelId;

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
      const ch = payload?.channel;
      if (!ch) return;
      const id = ch.id ?? ch._id;
      if (id) {
        dispatch(upsertChannel({ ...ch, id }));
      }
    });

    channel.bind(CHANNEL_UPDATED_EVENT, (payload: ChannelUpdatedPayload) => {
      if (!payload?.channelId) return;

      const isActive = activeChannelIdRef.current === payload.channelId;
      dispatch(
        updateChannelLastMessage({
          channelId: payload.channelId,
          lastMessagePreview: payload.lastMessagePreview,
          lastMessageAt: payload.lastMessageAt,
          ...(payload.unreadCountCleared || isActive
            ? { unreadCount: 0 }
            : payload.unreadCountIncrement
              ? { unreadCountIncrement: payload.unreadCountIncrement }
              : {}),
        }),
      );
    });

    channel.bind(CALL_INCOMING_EVENT, (payload: any) => {
      if (!payload?.callSessionId) return;
      const callSessionId = String(payload.callSessionId);
      const callerName = String(payload.callerName ?? "Unknown");
      const mode: "AUDIO" | "VIDEO" = payload.mode === "VIDEO" ? "VIDEO" : "AUDIO";
      // Cache the authoritative metadata BEFORE showing the notification.
      // The native answer event only carries a callUUID; this is how mode
      // and callerId survive the round-trip to the call screen.
      incomingCallMetadataMap.set(callSessionId, {
        mode,
        callerId: String(payload.callerId ?? ""),
        channelId: String(payload.channelId ?? ""),
        callerName,
      });
      displayIncomingCall(callSessionId, callerName, mode === "VIDEO");
      showFullScreenCallNotification(callSessionId, callerName, mode === "VIDEO");
    });

    channel.bind(CALL_CANCELLED_EVENT, (payload: any) => {
      if (!payload?.callSessionId) return;
      const callSessionId = String(payload.callSessionId);
      incomingCallMetadataMap.delete(callSessionId);
      endCallKeepCall(callSessionId);
      hideFullScreenCallNotification();
    });

    channel.bind(CALL_MISSED_EVENT, (payload: any) => {
      if (!payload?.callSessionId) return;
      const callSessionId = String(payload.callSessionId);
      incomingCallMetadataMap.delete(callSessionId);
      endCallKeepCall(callSessionId);
      hideFullScreenCallNotification();
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
