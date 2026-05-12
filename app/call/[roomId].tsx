import { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Vibration } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import Toast from "react-native-toast-message";

import { api } from "@/lib/api";
import { useAppSelector } from "@/hooks/redux";
import { useAppTheme } from "@/hooks/use-app-theme";

type CallStatus = "RINGING" | "ACTIVE" | "ENDED" | "REJECTED" | "MISSED" | "CANCELLED";

type CallSession = {
  callSessionId: string;
  channelId: string;
  teacherId: string;
  studentId: string;
  callerId: string | null;
  status: CallStatus;
  mode: "AUDIO" | "VIDEO";
  roomName: string;
};

export default function CallScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { isDark } = useAppTheme();
  const userId = useAppSelector((s) => s.user.data?._id ?? null);

  const [session, setSession] = useState<CallSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const fetchSession = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await api.get(`/calls/${roomId}`);
      setSession(res.data as CallSession);
    } catch {
      Toast.show({ type: "error", text1: "Could not load call session" });
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  // Timer while call is ACTIVE
  useEffect(() => {
    if (session?.status !== "ACTIVE") return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [session?.status]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const handleAccept = async () => {
    if (!session) return;
    setActing(true);
    try {
      await api.post(`/calls/${session.callSessionId}/accept`);
      setSession((prev) => (prev ? { ...prev, status: "ACTIVE" } : prev));
      setElapsed(0);
      Vibration.cancel();
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1: err?.response?.data?.error ?? "Failed to accept",
      });
    } finally {
      setActing(false);
    }
  };

  const handleDecline = async () => {
    if (!session) return;
    setActing(true);
    try {
      await api.post(`/calls/${session.callSessionId}/reject`);
      Vibration.cancel();
      router.back();
    } catch {
      router.back();
    } finally {
      setActing(false);
    }
  };

  const handleEnd = async () => {
    if (!session) return;
    setActing(true);
    try {
      await api.post(`/calls/${session.callSessionId}/end`);
    } catch {
      // best-effort
    } finally {
      setActing(false);
      router.back();
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (!session) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-8">
        <Ionicons name="call-outline" size={56} color="#ffffff40" />
        <Text className="mt-4 text-lg text-white/60">Call not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 rounded-full bg-white/10 px-6 py-3"
        >
          <Text className="text-white">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isIncoming = session.callerId !== null && session.callerId !== userId;
  const isVideo = session.mode === "VIDEO";
  const isEnded = ["ENDED", "REJECTED", "MISSED", "CANCELLED"].includes(session.status);

  // ── Ringing ──────────────────────────────────────────────────────────────
  if (session.status === "RINGING") {
    return (
      <View className="flex-1 items-center justify-between bg-black px-6 py-24">
        <View className="items-center gap-4">
          <View className="h-28 w-28 items-center justify-center rounded-full bg-blue-600">
            <Ionicons name={isVideo ? "videocam" : "call"} size={48} color="#fff" />
          </View>
          <Text className="mt-4 text-2xl font-bold text-white">
            {isIncoming ? "Incoming call" : "Calling…"}
          </Text>
          <Text className="text-white/50">{isVideo ? "Video call" : "Voice call"}</Text>
        </View>

        {isIncoming ? (
          <View className="w-full flex-row items-center justify-around">
            <View className="items-center gap-3">
              <TouchableOpacity
                onPress={handleDecline}
                disabled={acting}
                className="h-20 w-20 items-center justify-center rounded-full bg-red-500"
              >
                {acting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons
                    name="call"
                    size={32}
                    color="#fff"
                    style={{ transform: [{ rotate: "135deg" }] }}
                  />
                )}
              </TouchableOpacity>
              <Text className="text-sm text-white/60">Decline</Text>
            </View>
            <View className="items-center gap-3">
              <TouchableOpacity
                onPress={handleAccept}
                disabled={acting}
                className="h-20 w-20 items-center justify-center rounded-full bg-green-500"
              >
                {acting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons name={isVideo ? "videocam" : "call"} size={32} color="#fff" />
                )}
              </TouchableOpacity>
              <Text className="text-sm text-white/60">Accept</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleEnd}
            disabled={acting}
            className="h-20 w-20 items-center justify-center rounded-full bg-red-500"
          >
            {acting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons
                name="call"
                size={32}
                color="#fff"
                style={{ transform: [{ rotate: "135deg" }] }}
              />
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ── Active ────────────────────────────────────────────────────────────────
  if (session.status === "ACTIVE") {
    return (
      <View className="flex-1 items-center justify-between bg-black px-6 py-24">
        <View className="items-center gap-3">
          <View className="h-28 w-28 items-center justify-center rounded-full bg-green-700">
            <Ionicons name={isVideo ? "videocam" : "call"} size={48} color="#fff" />
          </View>
          <Text className="mt-4 text-2xl font-bold text-white">
            {isVideo ? "Video call" : "Voice call"}
          </Text>
          <Text className="font-mono text-lg text-green-400">{formatTime(elapsed)}</Text>
          <Text className="text-sm text-white/40">Room: {session.roomName}</Text>
        </View>

        <TouchableOpacity
          onPress={handleEnd}
          disabled={acting}
          className="h-20 w-20 items-center justify-center rounded-full bg-red-500"
        >
          {acting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons
              name="call"
              size={32}
              color="#fff"
              style={{ transform: [{ rotate: "135deg" }] }}
            />
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // ── Ended / Rejected / Missed ────────────────────────────────────────────
  return (
    <View className="flex-1 items-center justify-center gap-6 bg-black px-8">
      <Ionicons name="call-outline" size={56} color="#ffffff40" />
      <Text className="text-xl font-semibold text-white">
        {session.status === "MISSED"
          ? "Call missed"
          : session.status === "REJECTED"
            ? "Call declined"
            : "Call ended"}
      </Text>
      <TouchableOpacity
        onPress={() => router.back()}
        className="mt-2 rounded-full bg-white/10 px-8 py-3"
      >
        <Text className="text-white">Go back</Text>
      </TouchableOpacity>
    </View>
  );
}
