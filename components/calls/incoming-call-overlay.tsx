import { useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Vibration,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Audio } from "expo-av";

import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { clearIncomingCall } from "@/store/slices/incomingCallSlice";
import { api } from "@/lib/api";
import {
  displayIncomingCall,
  reportCallConnected,
  endCallKeepCall,
  preAcceptedCallRef,
} from "@/lib/callkeep-setup";
import {
  getPusherClient,
  getUserPusherName,
  CALL_CANCELLED_EVENT,
  CALL_MISSED_EVENT,
} from "@/lib/realtime";
import {
  showFullScreenCallNotification,
  hideFullScreenCallNotification,
} from "@/lib/full-screen-call-notification";

const RING_PATTERN = [0, 400, 200, 400, 200, 400];
const AUTO_DISMISS_MS = 45_000;

export function IncomingCallOverlay() {
  const dispatch = useAppDispatch();
  const call = useAppSelector((s) => s.incomingCall.call);
  // Need the current user's ID to subscribe to their personal Pusher channel
  // so we can dismiss the overlay when the caller cancels.
  const currentUserId = useAppSelector((s) => s.user.data?._id ?? null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringtoneSoundRef = useRef<Audio.Sound | null>(null);

  // Stop and unload the expo-av ringtone, then release the audio session so
  // hardware volume buttons go back to controlling the ringer instead of media.
  const stopRingSound = useCallback(async () => {
    const s = ringtoneSoundRef.current;
    if (s) {
      ringtoneSoundRef.current = null;
      try {
        await s.stopAsync();
        await s.unloadAsync();
      } catch {}
    }
    // Reset audio session to neutral defaults.  While the ringtone is playing
    // `staysActiveInBackground: true` keeps the audio engine open, which
    // makes Android/iOS route volume-button presses to the media stream rather
    // than the ringer.  Resetting here hands control back to the system.
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});
  }, []);

  const stopRing = useCallback(() => {
    Vibration.cancel();
    pulseAnim.stopAnimation();
    void stopRingSound();
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, [pulseAnim, stopRingSound]);

  const dismiss = useCallback(() => {
    stopRing();
    dispatch(clearIncomingCall());
  }, [stopRing, dispatch]);

  useEffect(() => {
    if (!call) return;

    // Show native call UI (for lock-screen / background handling via CallKeep)
    displayIncomingCall(call.callSessionId, call.callerName, call.mode === "VIDEO");
    showFullScreenCallNotification(
      call.callSessionId,
      call.callerName,
      call.mode === "VIDEO",
    );

    // Play ringtone via expo-av so it is audible when the app is in the
    // foreground (CallKeep's native audio only fires on the lock-screen /
    // background).  expo-av uses media volume; ringer-stream playback would
    // require a separate native module which is out-of-scope for now.
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});
    (async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require("../../assets/sounds/incoming_ringtone.mp3"),
          { shouldPlay: true, isLooping: true, volume: 1.0 },
        );
        ringtoneSoundRef.current = sound;
      } catch (err) {
        console.warn("[incoming-call] Failed to play ringtone:", err);
      }
    })();

    // Vibrate in ring pattern as tactile feedback
    Vibration.vibrate(RING_PATTERN, true);

    // Pulse animation on avatar
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    pulse.start();

    // Auto-dismiss as missed after 45 s
    const sessionId = call.callSessionId;
    dismissTimer.current = setTimeout(() => {
      void api.post(`/calls/${sessionId}/missed`).catch(() => {});
      endCallKeepCall(sessionId);
      hideFullScreenCallNotification();
      dismiss();
    }, AUTO_DISMISS_MS);

    // Listen for caller cancellation on the callee's personal Pusher channel
    // so we can dismiss the overlay immediately instead of waiting 45 s.
    // We bind/unbind only — never unsubscribe — because RealtimeBridge also
    // holds a subscription to the same user channel.
    const client = getPusherClient();
    const handleCancelled = (payload: any) => {
      if (payload?.callSessionId && payload.callSessionId !== sessionId) return;
      endCallKeepCall(sessionId);
      hideFullScreenCallNotification();
      dismiss();
    };
    let userChannel: ReturnType<
      NonNullable<ReturnType<typeof getPusherClient>>["subscribe"]
    > | null = null;
    if (client && currentUserId) {
      userChannel = client.subscribe(getUserPusherName(currentUserId));
      userChannel.bind(CALL_CANCELLED_EVENT, handleCancelled);
      userChannel.bind(CALL_MISSED_EVENT, handleCancelled);
    }

    return () => {
      pulse.stop();
      stopRing(); // also calls stopRingSound internally
      // Only unbind — do NOT unsubscribe (RealtimeBridge owns that subscription)
      if (userChannel) {
        userChannel.unbind(CALL_CANCELLED_EVENT, handleCancelled);
        userChannel.unbind(CALL_MISSED_EVENT, handleCancelled);
      }
    };
  }, [call, pulseAnim, dismiss, stopRing, currentUserId]);

  const handleAccept = async () => {
    if (!call) return;
    stopRing();
    hideFullScreenCallNotification();
    // Accept the call API directly so the call screen can skip RINGING
    // and jump straight to connecting to LiveKit.
    try {
      const res = await api.post(`/calls/${call.callSessionId}/accept`);
      const data = res.data as any;
      if (data?.token && data?.serverUrl) {
        preAcceptedCallRef.current = {
          token: data.token,
          serverUrl: data.serverUrl,
          channelId: data.channelId,
          timerDeadline: data.timerDeadline,
          timeExtensionCount: data.timeExtensionCount ?? 0,
          mode: call.mode,
          callerId: call.callerId,
        };
      }
    } catch (err) {
      const status = (err as any)?.response?.status;
      if (status === 409) {
        // Call was already accepted (e.g. by CallKeep answer event or call screen
        // auto-accept). Don't navigate — the call screen is already handling it.
        console.warn(
          "[overlay] Pre-accept 409: call already accepted, skipping navigation",
        );
        reportCallConnected(call.callSessionId);
        dispatch(clearIncomingCall());
        return;
      }
      // Other errors — navigate to call screen for fallback flow
      console.warn("[overlay] Pre-accept failed, fallback to normal flow:", err);
    }
    reportCallConnected(call.callSessionId);
    dispatch(clearIncomingCall());
    router.push(`/call/${call.callSessionId}` as any);
  };

  const handleDecline = async () => {
    if (!call) return;
    stopRing();
    hideFullScreenCallNotification();
    endCallKeepCall(call.callSessionId);
    void api.post(`/calls/${call.callSessionId}/reject`).catch(() => {});
    dismiss();
  };

  if (!call) return null;

  const isVideo = call.mode === "VIDEO";
  const initials = call.callerName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent>
      <View className="flex-1 items-center justify-between bg-black/90 px-6 py-20">
        {/* Top section — caller info */}
        <View className="mt-10 items-center gap-4">
          <Text className="text-base uppercase tracking-widest text-white/60">
            Incoming {isVideo ? "Video" : "Audio"} Call
          </Text>

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            {call.callerImage ? (
              <Image
                source={{ uri: call.callerImage }}
                className="h-32 w-32 rounded-full border-4 border-white/20"
              />
            ) : (
              <View className="h-32 w-32 items-center justify-center rounded-full border-4 border-white/20 bg-blue-600">
                <Text className="text-4xl font-bold text-white">{initials}</Text>
              </View>
            )}
          </Animated.View>

          <Text className="mt-2 text-3xl font-bold text-white">{call.callerName}</Text>
          <Text className="text-sm text-white/50">
            {isVideo ? "Wants to video call with you" : "Wants to voice call with you"}
          </Text>
        </View>

        {/* Bottom section — buttons */}
        <View className="w-full flex-row items-center justify-around">
          {/* Decline */}
          <View className="items-center gap-3">
            <TouchableOpacity
              onPress={handleDecline}
              className="h-20 w-20 items-center justify-center rounded-full bg-red-500"
              activeOpacity={0.8}
            >
              <Ionicons
                name="call"
                size={32}
                color="#fff"
                style={{ transform: [{ rotate: "135deg" }] }}
              />
            </TouchableOpacity>
            <Text className="text-sm text-white/60">Decline</Text>
          </View>

          {/* Accept */}
          <View className="items-center gap-3">
            <TouchableOpacity
              onPress={handleAccept}
              className="h-20 w-20 items-center justify-center rounded-full bg-green-500"
              activeOpacity={0.8}
            >
              <Ionicons name={isVideo ? "videocam" : "call"} size={32} color="#fff" />
            </TouchableOpacity>
            <Text className="text-sm text-white/60">Accept</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
