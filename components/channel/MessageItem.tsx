import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import type { ChatMessage } from "@/store/slices/channelSlice";

type Props = {
  item: ChatMessage | { __dateSeparator: string };
  userId: string | null;
  isAcceptor: boolean;
  isActive: boolean;
  isAnswerSubmitted: boolean;
  primaryColor: string;
  cardColor: string;
  borderColor: string;
  mutedIconColor: string;
  formatMessageTime: (iso: string) => string;
  onImageOpen: (url: string) => void;
  onRetry: (msg: ChatMessage) => void;
  onToggleMark: (id: string, isMarked: boolean) => void;
};

// ── Audio player sub-component ────────────────────────────────────────────────
// Kept separate so hooks always run unconditionally in MessageItemInner.
function AudioMessagePlayer({
  mediaUrl,
  isOwn,
  primaryColor,
}: {
  mediaUrl: string;
  isOwn: boolean;
  primaryColor: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionSec, setPositionSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Clean up sound on unmount
  useEffect(() => {
    return () => {
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, []);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const handlePress = useCallback(async () => {
    // If already playing — pause
    if (isPlaying && soundRef.current) {
      try {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } catch {}
      return;
    }

    // If sound exists but paused — resume
    if (soundRef.current) {
      try {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      } catch {}
      return;
    }

    // Load and play fresh
    setIsLoading(true);
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: mediaUrl },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          setPositionSec((status.positionMillis ?? 0) / 1000);
          setDurationSec((status.durationMillis ?? 0) / 1000);
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPositionSec(0);
            // Unload so next tap reloads from start
            sound.unloadAsync().catch(() => {});
            soundRef.current = null;
          }
        },
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } catch {
      // silent — network / format errors
    } finally {
      setIsLoading(false);
    }
  }, [isPlaying, mediaUrl]);

  const iconColor = isOwn ? "#fff" : "#1c1917";
  const textColor = isOwn ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.6)";
  const trackBg = isOwn ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.1)";
  const trackFg = isOwn ? "#fff" : primaryColor;
  const progress = durationSec > 0 ? positionSec / durationSec : 0;

  return (
    <View className="my-1 flex-row items-center gap-2" style={{ minWidth: 180 }}>
      {/* Play / Pause button */}
      <TouchableOpacity
        onPress={handlePress}
        disabled={isLoading}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isOwn ? "rgba(255,255,255,0.2)" : `${primaryColor}20`,
        }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <Ionicons name={isPlaying ? "pause" : "play"} size={18} color={iconColor} />
        )}
      </TouchableOpacity>

      {/* Progress bar + time */}
      <View className="flex-1 gap-1">
        {/* Track */}
        <View
          style={{
            height: 3,
            borderRadius: 2,
            backgroundColor: trackBg,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: 3,
              width: `${Math.round(progress * 100)}%`,
              backgroundColor: trackFg,
              borderRadius: 2,
            }}
          />
        </View>
        {/* Time label */}
        <Text style={{ fontSize: 11, color: textColor }}>
          {durationSec > 0
            ? `${formatTime(positionSec)} / ${formatTime(durationSec)}`
            : isPlaying
              ? formatTime(positionSec)
              : "Voice message"}
        </Text>
      </View>
    </View>
  );
}

// ── Main message item ─────────────────────────────────────────────────────────
function MessageItemInner({
  item,
  userId,
  isAcceptor,
  isActive,
  isAnswerSubmitted,
  primaryColor,
  cardColor,
  borderColor,
  mutedIconColor,
  formatMessageTime,
  onImageOpen,
  onRetry,
  onToggleMark,
}: Props) {
  // ── Date separator ──
  if ("__dateSeparator" in item) {
    return (
      <View className="my-3 items-center">
        <View className="bg-muted/30 rounded-full px-3 py-1">
          <Text className="text-[13px] font-medium text-muted-foreground">
            {item.__dateSeparator}
          </Text>
        </View>
      </View>
    );
  }

  const msg = item;

  // ── Deleted message ──
  if (msg.isDeleted) {
    return (
      <View className="my-1 items-center">
        <View className="bg-muted/20 flex-row items-center gap-1.5 rounded-full px-3 py-1.5">
          <Ionicons name="trash-outline" size={16} color={mutedIconColor} />
          <Text className="text-[13px] text-muted-foreground">Message deleted</Text>
        </View>
      </View>
    );
  }

  // ── System message ──
  if (msg.isSystemMessage) {
    return (
      <View className="my-2 items-center px-12">
        <View className="rounded-2xl bg-sky-500/10 px-5 py-3">
          <Text className="text-center text-[15px] leading-6 text-sky-700 dark:text-sky-300">
            {msg.content}
          </Text>
        </View>
      </View>
    );
  }

  // ── Regular message ──
  const isOwn = msg.isOwn || msg.senderId === userId;
  const showMark = isAcceptor && isActive && isOwn && !isAnswerSubmitted;

  return (
    <View className={`my-1 px-3 ${isOwn ? "items-end" : "items-start"}`}>
      <View
        style={{
          maxWidth: "80%",
          borderRadius: 18,
          padding: 12,
          backgroundColor: isOwn ? primaryColor : cardColor,
          borderWidth: isOwn ? 0 : 1,
          borderColor: isOwn ? undefined : borderColor,
          ...(msg.isMarkedAsAnswer
            ? {
                borderWidth: 2,
                borderColor: "#f59e0b",
              }
            : {}),
        }}
      >
        {!isOwn && msg.senderName ? (
          <Text className="mb-1 text-[13px] font-semibold text-muted-foreground">
            {msg.senderName}
          </Text>
        ) : null}

        {/* Image */}
        {msg.mediaUrl && msg.mediaType === "IMAGE" ? (
          <TouchableOpacity onPress={() => onImageOpen(msg.mediaUrl!)} className="mb-1.5">
            <Image
              source={{ uri: msg.mediaUrl }}
              className="h-56 w-56 rounded-xl"
              resizeMode="cover"
            />
          </TouchableOpacity>
        ) : null}

        {/* Audio — playable for both sender and receiver */}
        {msg.mediaType === "AUDIO" && msg.mediaUrl ? (
          <AudioMessagePlayer
            mediaUrl={msg.mediaUrl}
            isOwn={isOwn}
            primaryColor={primaryColor}
          />
        ) : null}

        {/* Text content */}
        {msg.content ? (
          <Text
            className="text-[16px] leading-6"
            style={{ color: isOwn ? "#fff" : "#1c1917" }}
          >
            {msg.content}
          </Text>
        ) : null}

        {/* Footer: time + status */}
        <View className="mt-1 flex-row items-center justify-end gap-1">
          <Text
            className="text-[11px]"
            style={{ color: isOwn ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)" }}
          >
            {formatMessageTime(msg.sentAt)}
          </Text>
          {msg.isSending && isOwn && !msg.sendFailed ? (
            <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.5)" />
          ) : null}
          {msg.isDelivered && isOwn && !msg.sendFailed ? (
            <Ionicons name="checkmark" size={13} color="rgba(255,255,255,0.5)" />
          ) : null}
          {msg.isSeen && isOwn ? (
            <Ionicons name="checkmark-done" size={13} color="#60a5fa" />
          ) : null}
        </View>

        {/* Retry button */}
        {msg.sendFailed ? (
          <TouchableOpacity
            onPress={() => onRetry(msg)}
            className="mt-1 flex-row items-center gap-1"
          >
            <Ionicons name="alert-circle" size={15} color="#ef4444" />
            <Text className="text-[12px] text-red-500">Tap to retry</Text>
          </TouchableOpacity>
        ) : null}

        {/* Mark as answer star (acceptor only) */}
        {showMark ? (
          <TouchableOpacity
            onPress={() => onToggleMark(msg.id || msg._id || "", !!msg.isMarkedAsAnswer)}
            className="absolute -right-2 -top-2 h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: cardColor }}
          >
            <Ionicons
              name={msg.isMarkedAsAnswer ? "star" : "star-outline"}
              size={20}
              color="#f59e0b"
            />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export const MessageItem = React.memo(MessageItemInner);
