import { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { api } from "@/lib/api";

type Props = {
  timerDeadline: string | null;
  isActive: boolean;
  isAnswerSubmitted: boolean;
  timeExtensionCount: number;
  primaryColor: string;
  channelId: string | null;
};

function formatCountdown(ms: number) {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function ChannelTimer({
  timerDeadline,
  isActive,
  isAnswerSubmitted,
  timeExtensionCount,
  primaryColor,
  channelId,
}: Props) {
  const [countdown, setCountdown] = useState(0);
  const [isExtending, setIsExtending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Countdown timer (runs locally without re-rendering parent) ──
  useEffect(() => {
    if (!timerDeadline) return;
    const update = () => {
      const remaining = new Date(timerDeadline).getTime() - Date.now();
      setCountdown(Math.max(0, remaining));
    };
    update();
    intervalRef.current = setInterval(update, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerDeadline]);

  // ── Extend handler ──
  const handleExtend = async () => {
    if (!channelId || isExtending) return;
    setIsExtending(true);
    try {
      await api.post(`/channels/${channelId}/extend`);
      // Timer deadline gets updated via Pusher CHANNEL_TIMER_UPDATED_EVENT
      Toast.show({ type: "success", text1: "Added 5 more minutes" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[workspace] Extend failed:", msg);
      Toast.show({
        type: "error",
        text1: (err as any)?.response?.data?.error ?? "Failed to extend",
      });
    } finally {
      setIsExtending(false);
    }
  };

  const timerColor =
    countdown <= 0
      ? "#ef4444"
      : countdown < 5 * 60 * 1000
        ? "#ef4444"
        : countdown < 15 * 60 * 1000
          ? "#f59e0b"
          : primaryColor;

  const canExtend =
    isActive &&
    !isAnswerSubmitted &&
    countdown > 0 &&
    countdown <= 5 * 60 * 1000 &&
    timeExtensionCount < 5;

  return (
    <View>
      {/* Call buttons + Timer row */}
      {timerDeadline ? (
        <View
          className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
          style={{ backgroundColor: `${timerColor}18` }}
        >
          <Ionicons name="timer-outline" size={13} color={timerColor} />
          <Text className="text-[11px] font-bold" style={{ color: timerColor }}>
            {formatCountdown(countdown)}
          </Text>
        </View>
      ) : (
        <View className="bg-muted/30 rounded-full px-2.5 py-1">
          <Text className="text-[11px] font-semibold text-muted-foreground">
            {!isActive ? "Closed" : "Active"}
          </Text>
        </View>
      )}

      {/* Extend button */}
      {isActive && canExtend ? (
        <View className="mt-2 flex-row items-center gap-2">
          <TouchableOpacity
            onPress={handleExtend}
            disabled={isExtending}
            className="flex-row items-center gap-1 rounded-full border px-3 py-1.5"
            style={{ borderColor: timerColor }}
          >
            {isExtending ? (
              <ActivityIndicator size={12} color={timerColor} />
            ) : (
              <Ionicons name="add-circle-outline" size={14} color={timerColor} />
            )}
            <Text className="text-[11px] font-semibold" style={{ color: timerColor }}>
              +5 min
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
