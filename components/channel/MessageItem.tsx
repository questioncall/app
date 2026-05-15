import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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

        {msg.mediaUrl && msg.mediaType === "IMAGE" ? (
          <TouchableOpacity onPress={() => onImageOpen(msg.mediaUrl!)} className="mb-1.5">
            <Image
              source={{ uri: msg.mediaUrl }}
              className="h-56 w-56 rounded-xl"
              resizeMode="cover"
            />
          </TouchableOpacity>
        ) : null}

        {msg.mediaType === "AUDIO" ? (
          <View className="my-1 flex-row items-center gap-2">
            <Ionicons name="musical-note" size={20} color="#fff" />
            <Text className="text-[14px] text-white/80">Voice message</Text>
          </View>
        ) : null}

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
