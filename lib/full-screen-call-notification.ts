import { Platform, NativeModules, NativeEventEmitter } from "react-native";
import { router } from "expo-router";
import {
  endCallKeepCall,
  reportCallConnected,
  preAcceptedCallRef,
  incomingCallMetadataMap,
} from "@/lib/callkeep-setup";
import { getPrewarmedCalleeRoom } from "@/lib/call-prewarm";

const CHANNEL_ID = "incoming_calls_fs";
const CHANNEL_NAME = "Incoming Calls";
const NOTIFICATION_TIMEOUT = 45000;

let listenersRegistered = false;

function getNativeModule() {
  return NativeModules.FullScreenNotificationIncomingCall;
}

export function setupFullScreenCallListeners() {
  if (Platform.OS !== "android" || listenersRegistered) return;
  const nativeModule = getNativeModule();
  if (!nativeModule) return;
  listenersRegistered = true;

  const emitter = new NativeEventEmitter(nativeModule);

  emitter.addListener("RNNotificationAnswerAction", (payload) => {
    const callUUID = payload?.callUUID;
    if (!callUUID) return;
    void acceptCall(callUUID);
  });

  emitter.addListener("RNNotificationEndCallAction", (payload) => {
    const callUUID = payload?.callUUID;
    if (!callUUID) return;
    endCallKeepCall(callUUID);
    if (payload?.endAction === "ACTION_REJECTED_CALL") {
      void rejectCall(callUUID);
    }
  });
}

async function acceptCall(callSessionId: string) {
  // Pull cached metadata captured at incoming-call time.  Pusher/push payload
  // mode is authoritative — the server /accept response is a fallback for
  // cases where the user accepts before we cached anything (e.g. cold start).
  const meta = incomingCallMetadataMap.get(callSessionId);

  // If realtime-bridge already pre-warmed a LiveKit room from the Pusher
  // payload, the call screen will consume it directly. We can hand it the
  // cached token immediately, skipping the wait on the /accept response.
  const prewarm = getPrewarmedCalleeRoom(callSessionId);
  if (prewarm && meta) {
    preAcceptedCallRef.current = {
      token: prewarm.token.token,
      serverUrl: prewarm.token.serverUrl,
      channelId: prewarm.token.channelId,
      timerDeadline: prewarm.token.timerDeadline,
      timeExtensionCount: prewarm.token.timeExtensionCount,
      mode: meta.mode,
      callerId: meta.callerId,
    };
    incomingCallMetadataMap.delete(callSessionId);
    reportCallConnected(callSessionId);
    router.replace(`/call/${callSessionId}` as any);
    // Fire the accept API in the background — server still needs to flip
    // status from RINGING to ACTIVE and notify the caller via Pusher. The
    // user is already looking at the call screen by the time it returns.
    void (async () => {
      try {
        const { api } = await import("@/lib/api");
        await api.post(`/calls/${callSessionId}/accept`);
      } catch (err: any) {
        if (err?.response?.status !== 409) {
          console.warn(
            "[acceptCall] background /accept failed:",
            err instanceof Error ? err.message : String(err),
          );
        }
      }
    })();
    return;
  }

  // Fallback: no pre-warm available (e.g. Pusher payload was missing the
  // token for some reason). Use the original blocking /accept path.
  try {
    const { api } = await import("@/lib/api");
    const res = await api.post(`/calls/${callSessionId}/accept`);
    const data = res.data as any;
    if (data?.token && data?.serverUrl) {
      const serverMode =
        data.mode === "VIDEO" || data.mode === "AUDIO" ? data.mode : null;
      preAcceptedCallRef.current = {
        token: data.token,
        serverUrl: data.serverUrl,
        channelId: data.channelId ?? meta?.channelId ?? "",
        timerDeadline: data.timerDeadline,
        timeExtensionCount: data.timeExtensionCount ?? 0,
        // Prefer the mode from the original pusher payload — that's what
        // displayed "video call" to the user.  Only fall back to the server
        // response when we have no cached metadata.
        mode: meta?.mode ?? serverMode ?? "AUDIO",
        callerId: data.callerId ?? meta?.callerId ?? "",
      };
    }
  } catch (err: any) {
    if (err?.response?.status === 409) {
      // Already accepted elsewhere — still navigate to the call
    }
  }
  incomingCallMetadataMap.delete(callSessionId);
  reportCallConnected(callSessionId);
  router.replace(`/call/${callSessionId}` as any);
}

async function rejectCall(callSessionId: string) {
  incomingCallMetadataMap.delete(callSessionId);
  try {
    const { api } = await import("@/lib/api");
    await api.post(`/calls/${callSessionId}/reject`);
  } catch {}
}

export function showFullScreenCallNotification(
  callSessionId: string,
  callerName: string,
  isVideo: boolean,
) {
  if (Platform.OS !== "android") return;
  const nativeModule = getNativeModule();
  if (!nativeModule) return;

  nativeModule.displayNotification(callSessionId, null, NOTIFICATION_TIMEOUT, {
    channelId: CHANNEL_ID,
    channelName: CHANNEL_NAME,
    notificationIcon: "ic_launcher",
    notificationTitle: callerName,
    notificationBody: isVideo ? "Incoming video call..." : "Incoming voice call...",
    answerText: "Accept",
    declineText: "Decline",
    notificationColor: "notification_icon_color",
    notificationSound: "incoming_ringtone",
    isVideo,
  });
}

export function hideFullScreenCallNotification() {
  if (Platform.OS !== "android") return;
  const nativeModule = getNativeModule();
  if (!nativeModule) return;
  nativeModule.hideNotification();
}
