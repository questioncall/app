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

import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { clearIncomingCall } from "@/store/slices/incomingCallSlice";
import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";

const RING_PATTERN = [0, 400, 200, 400, 200, 400];
const AUTO_DISMISS_MS = 45_000;

export function IncomingCallOverlay() {
  const dispatch = useAppDispatch();
  const { isDark } = useAppTheme();
  const call = useAppSelector((s) => s.incomingCall.call);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopRing = useCallback(() => {
    Vibration.cancel();
    pulseAnim.stopAnimation();
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, [pulseAnim]);

  const dismiss = useCallback(() => {
    stopRing();
    dispatch(clearIncomingCall());
  }, [stopRing, dispatch]);

  useEffect(() => {
    if (!call) return;

    // Vibrate in ring pattern
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
    dismissTimer.current = setTimeout(() => {
      void api.post(`/calls/${call.callSessionId}/missed`).catch(() => {});
      dismiss();
    }, AUTO_DISMISS_MS);

    return () => {
      pulse.stop();
      stopRing();
    };
  }, [call, pulseAnim, dismiss, stopRing]);

  const handleAccept = async () => {
    if (!call) return;
    stopRing();
    try {
      await api.post(`/calls/${call.callSessionId}/accept`);
    } catch {
      // best-effort: the call screen will handle stale status
    }
    dispatch(clearIncomingCall());
    router.push(`/call/${call.callSessionId}` as any);
  };

  const handleDecline = async () => {
    if (!call) return;
    stopRing();
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
