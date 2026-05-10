import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import Toast from "react-native-toast-message";

import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";
import {
  ANSWER_SUBMITTED_EVENT,
  CHANNEL_CLOSED_EVENT,
  CHANNEL_MESSAGE_EVENT,
  CHANNEL_MESSAGES_SEEN_EVENT,
  CHANNEL_STATUS_EVENT,
  CHANNEL_TIMER_UPDATED_EVENT,
  MESSAGE_DELETED_EVENT,
  MESSAGE_MARKED_EVENT,
  getChannelPusherName,
  getPusherClient,
} from "@/lib/realtime";
import {
  appendMessage,
  addPendingMessage,
  clearChannel,
  failPendingMessage,
  markMessagesAsSeen,
  resolvePendingMessage,
  setAnswerSubmitted,
  setChannelData,
  setChannelError,
  setChannelLoading,
  setChannelStatus,
  setChannelTimer,
  setMessageDeleted,
  toggleMessageMarked,
  type ChatMessage,
  type ChannelDetail,
} from "@/store/slices/channelSlice";
import { markChannelRead } from "@/store/slices/channelsSlice";
import {
  enqueueFailedMessage,
  dequeueMessage,
  getFailedMessages,
} from "@/lib/message-retry-queue";

function formatCountdown(ms: number) {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatMessageTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function formatMessageDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function WorkspaceScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const dispatch = useAppDispatch();
  const userId = useAppSelector((s) => s.user.data?._id ?? null);
  const cached = useAppSelector((s) =>
    channelId ? (s.channel.cache[channelId] ?? null) : null,
  );
  const isLoading = useAppSelector((s) => s.channel.isLoading);
  const channelError = useAppSelector((s) => s.channel.error);
  const {
    statusBarStyle,
    backgroundColor,
    cardColor,
    borderColor,
    primaryColor,
    primarySoftColor,
    mutedIconColor,
    isDark,
  } = useAppTheme();

  const detail = cached?.detail ?? null;
  const messages = cached?.messages ?? [];

  const isAsker = userId === detail?.askerId;
  const isAcceptor = userId === detail?.acceptorId;
  const isActive = detail?.status === "ACTIVE";

  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isExtending, setIsExtending] = useState(false);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  const flatListRef = useRef<FlatList<any>>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLoadingOlderRef = useRef(false);

  const PAGE_SIZE = 30;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const CACHE_TTL_MS = 30_000;

  // ─── Fetch channel data ────────────────────────────────────────
  const fetchChannel = useCallback(
    async (force = false) => {
      if (!channelId) return;
      if (!force) dispatch(setChannelLoading(true));
      try {
        const res = await api.get(`/channels/${channelId}`);
        const { channel, messages: msgs } = res.data;
        const serverMessages = (msgs as ChatMessage[]) ?? [];
        const persisted = await getFailedMessages(channelId);
        const failedMessages: ChatMessage[] = persisted.map((p) => ({
          id: p.localId,
          localId: p.localId,
          channelId: p.channelId,
          senderId: userId ?? "",
          senderName: "You",
          content: p.content ?? "",
          mediaUrl: p.mediaUrl ?? null,
          mediaType: p.mediaType ?? null,
          isSystemMessage: false,
          isOwn: true,
          isSeen: false,
          isDelivered: false,
          isMarkedAsAnswer: false,
          isDeleted: false,
          sentAt: p.createdAt,
          isSending: false,
          sendFailed: true,
        }));
        dispatch(
          setChannelData({
            channelId,
            detail: channel as ChannelDetail,
            messages: [...serverMessages, ...failedMessages],
          }),
        );
      } catch (err: any) {
        if (!cached) {
          dispatch(
            setChannelError(err?.response?.data?.error ?? "Failed to load channel"),
          );
        }
      }
    },
    [channelId, dispatch, userId, cached],
  );

  useEffect(() => {
    if (!channelId) return;
    const isFresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;
    if (isFresh) {
      dispatch(
        setChannelData({
          channelId,
          detail: cached.detail,
          messages: cached.messages,
        }),
      );
    } else {
      void fetchChannel();
    }
    return () => {
      dispatch(clearChannel());
    };
  }, [channelId, dispatch]);

  // ─── Mark as read on mount ─────────────────────────────────────
  useEffect(() => {
    if (!channelId || !detail) return;
    api.post(`/channels/${channelId}/read`).catch(() => {});
    dispatch(markChannelRead(channelId));
    dispatch(markMessagesAsSeen());
  }, [channelId, detail, dispatch]);

  // ─── Countdown timer ───────────────────────────────────────────
  useEffect(() => {
    if (!detail?.timerDeadline) return;
    const update = () => {
      const remaining = new Date(detail.timerDeadline).getTime() - Date.now();
      setCountdown(Math.max(0, remaining));
    };
    update();
    countdownRef.current = setInterval(update, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [detail?.timerDeadline]);

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
    !detail?.isAnswerSubmitted &&
    countdown > 0 &&
    countdown <= 5 * 60 * 1000 &&
    (detail?.timeExtensionCount ?? 0) < 5;

  // ─── Pusher subscription ───────────────────────────────────────
  useEffect(() => {
    if (!channelId) return;
    const client = getPusherClient();
    if (!client) return;

    const pusherChannel = client.subscribe(getChannelPusherName(channelId));

    pusherChannel.bind(CHANNEL_MESSAGE_EVENT, (payload: any) => {
      const msg = payload?.message ?? payload;
      if (!msg?.id && !msg?._id) return;
      const normalized: ChatMessage = {
        id: msg.id || msg._id,
        channelId: msg.channelId || channelId,
        senderId: msg.senderId || "",
        senderName: msg.senderName || "",
        content: msg.content || "",
        mediaUrl: msg.mediaUrl ?? null,
        mediaType: msg.mediaType ?? null,
        isSystemMessage: Boolean(msg.isSystemMessage),
        isOwn: msg.senderId === userId,
        isSeen: Boolean(msg.isSeen),
        isDelivered: true,
        isMarkedAsAnswer: Boolean(msg.isMarkedAsAnswer),
        isDeleted: Boolean(msg.isDeleted),
        sentAt: msg.sentAt || new Date().toISOString(),
      };
      if (!normalized.isOwn) {
        dispatch(appendMessage(normalized));
        api.post(`/channels/${channelId}/read`).catch(() => {});
        dispatch(markChannelRead(channelId));
      }
    });

    pusherChannel.bind(CHANNEL_TIMER_UPDATED_EVENT, (payload: any) => {
      if (payload?.timerDeadline) {
        dispatch(
          setChannelTimer({
            timerDeadline: payload.timerDeadline,
            timeExtensionCount: payload.timeExtensionCount ?? 0,
          }),
        );
        if (payload.extendedBy && payload.extendedBy !== userId) {
          Toast.show({
            type: "info",
            text1: `${payload.extendedByName || "Someone"} added ${payload.extensionMinutes || 5} more minutes.`,
          });
        }
      }
    });

    pusherChannel.bind(CHANNEL_CLOSED_EVENT, (payload: any) => {
      dispatch(
        setChannelStatus({
          status: "CLOSED",
          ratingGiven: payload?.ratingGiven ?? null,
        }),
      );
    });

    pusherChannel.bind(CHANNEL_STATUS_EVENT, (payload: any) => {
      if (payload?.status) {
        dispatch(
          setChannelStatus({
            status: payload.status,
            ratingGiven: payload.ratingGiven,
          }),
        );
      }
    });

    pusherChannel.bind(MESSAGE_MARKED_EVENT, (payload: any) => {
      if (payload?.messageId) {
        dispatch(
          toggleMessageMarked({
            messageId: payload.messageId,
            isMarkedAsAnswer: Boolean(payload.isMarkedAsAnswer),
          }),
        );
      }
    });

    pusherChannel.bind(MESSAGE_DELETED_EVENT, (payload: any) => {
      if (payload?.messageId) dispatch(setMessageDeleted(payload.messageId));
    });

    pusherChannel.bind(CHANNEL_MESSAGES_SEEN_EVENT, () => {
      dispatch(markMessagesAsSeen());
    });

    pusherChannel.bind(ANSWER_SUBMITTED_EVENT, () => {
      dispatch(setAnswerSubmitted(true));
    });

    return () => {
      pusherChannel.unbind_all();
      client.unsubscribe(getChannelPusherName(channelId));
    };
  }, [channelId, userId, dispatch]);

  // ─── Send message ──────────────────────────────────────────────
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isSending || !isActive) return;

    const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: ChatMessage = {
      id: localId,
      localId,
      channelId: channelId!,
      senderId: userId!,
      senderName: "You",
      content: text,
      isSystemMessage: false,
      isOwn: true,
      isSeen: false,
      isDelivered: false,
      isMarkedAsAnswer: false,
      isDeleted: false,
      sentAt: new Date().toISOString(),
      isSending: true,
    };

    setInputText("");
    dispatch(addPendingMessage(optimistic));
    setIsSending(true);

    try {
      const res = await api.post(`/channels/${channelId}/messages`, {
        content: text,
      });
      const serverMsg = res.data as ChatMessage;
      dispatch(
        resolvePendingMessage({
          localId,
          message: {
            ...serverMsg,
            isOwn: true,
            isDelivered: true,
            isSending: false,
          },
        }),
      );
      dequeueMessage(localId).catch(() => {});
    } catch {
      dispatch(failPendingMessage(localId));
      enqueueFailedMessage(optimistic).catch(() => {});
      Toast.show({ type: "error", text1: "Failed to send message" });
    } finally {
      setIsSending(false);
    }
  };

  // ─── Send image ────────────────────────────────────────────────
  const handlePickImage = async () => {
    if (!isActive) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({ type: "error", text1: "Photo library permission required." });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const localId = `local_img_${Date.now()}`;
    const optimistic: ChatMessage = {
      id: localId,
      localId,
      channelId: channelId!,
      senderId: userId!,
      senderName: "You",
      content: "",
      mediaUrl: asset.uri,
      mediaType: "image",
      isSystemMessage: false,
      isOwn: true,
      isSeen: false,
      isDelivered: false,
      isMarkedAsAnswer: false,
      isDeleted: false,
      sentAt: new Date().toISOString(),
      isSending: true,
    };
    dispatch(addPendingMessage(optimistic));

    try {
      const form = new FormData();
      form.append("file", {
        uri: asset.uri,
        name: asset.fileName ?? `chat-${Date.now()}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
      } as unknown as Blob);
      const uploadRes = await api.post("/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 30000,
      });
      const mediaUrl = uploadRes.data?.secure_url ?? uploadRes.data?.url;

      const res = await api.post(`/channels/${channelId}/messages`, {
        mediaUrl,
        mediaType: "image",
      });
      dispatch(
        resolvePendingMessage({
          localId,
          message: { ...(res.data as ChatMessage), isOwn: true, isDelivered: true },
        }),
      );
      dequeueMessage(localId).catch(() => {});
    } catch {
      dispatch(failPendingMessage(localId));
      enqueueFailedMessage(optimistic).catch(() => {});
      Toast.show({ type: "error", text1: "Failed to send image" });
    }
  };

  // ─── Mark as answer (teacher only) ─────────────────────────────
  const handleToggleMark = async (messageId: string, currentMark: boolean) => {
    const next = !currentMark;
    dispatch(toggleMessageMarked({ messageId, isMarkedAsAnswer: next }));
    try {
      await api.post(`/channels/${channelId}/mark-answer`, {
        messageId,
        isMarkedAsAnswer: next,
      });
    } catch {
      dispatch(toggleMessageMarked({ messageId, isMarkedAsAnswer: currentMark }));
      Toast.show({ type: "error", text1: "Failed to mark answer" });
    }
  };

  // ─── Extend timer ──────────────────────────────────────────────
  const handleExtend = async () => {
    if (!canExtend) return;
    setIsExtending(true);
    try {
      const res = await api.post(`/channels/${channelId}/extend`);
      dispatch(
        setChannelTimer({
          timerDeadline: res.data.timerDeadline,
          timeExtensionCount: res.data.timeExtensionCount,
        }),
      );
      Toast.show({ type: "success", text1: "Added 5 more minutes." });
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1: err?.response?.data?.error ?? "Failed to extend timer",
      });
    } finally {
      setIsExtending(false);
    }
  };

  // ─── Close & Rate (asker only) ─────────────────────────────────
  const handleClose = async () => {
    if (!selectedRating || isClosing) return;
    setIsClosing(true);
    try {
      await api.post(`/channels/${channelId}/close`, {
        rating: selectedRating,
      });
      dispatch(setChannelStatus({ status: "CLOSED", ratingGiven: selectedRating }));
      setRatingModalVisible(false);
      Toast.show({ type: "success", text1: "Channel closed. Thank you for rating!" });
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1: err?.response?.data?.error ?? "Failed to close channel",
      });
    } finally {
      setIsClosing(false);
    }
  };

  // ─── Submit answer (teacher only) ──────────────────────────────
  const markedMessageIds = useMemo(
    () =>
      messages
        .filter((m) => m.isMarkedAsAnswer && !m.localId)
        .map((m) => m.id || m._id)
        .filter(Boolean) as string[],
    [messages],
  );

  const handleSubmitAnswer = async () => {
    if (markedMessageIds.length === 0) {
      Toast.show({
        type: "error",
        text1: "Mark at least one message as the answer first.",
      });
      return;
    }
    Alert.alert(
      "Submit Answer",
      `Submit ${markedMessageIds.length} marked message${markedMessageIds.length > 1 ? "s" : ""} as your answer?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            try {
              await api.post("/answers", {
                channelId,
                markedMessageIds,
              });
              dispatch(setAnswerSubmitted(true));
              Toast.show({ type: "success", text1: "Answer submitted!" });
            } catch (err: any) {
              Toast.show({
                type: "error",
                text1: err?.response?.data?.error ?? "Failed to submit answer",
              });
            }
          },
        },
      ],
    );
  };

  // ─── Retry failed message ─────────────────────────────────────
  const handleRetry = async (msg: ChatMessage) => {
    if (!msg.localId) return;
    dispatch(
      resolvePendingMessage({
        localId: msg.localId,
        message: { ...msg, isSending: true, sendFailed: false },
      }),
    );
    try {
      const payload: Record<string, string> = {};
      if (msg.content) payload.content = msg.content;
      if (msg.mediaUrl) {
        payload.mediaUrl = msg.mediaUrl;
        payload.mediaType = msg.mediaType ?? "image";
      }
      const res = await api.post(`/channels/${channelId}/messages`, payload);
      dispatch(
        resolvePendingMessage({
          localId: msg.localId,
          message: { ...(res.data as ChatMessage), isOwn: true, isDelivered: true },
        }),
      );
      dequeueMessage(msg.localId).catch(() => {});
    } catch {
      dispatch(failPendingMessage(msg.localId));
    }
  };

  const handleLoadOlder = useCallback(() => {
    isLoadingOlderRef.current = true;
    setVisibleCount((c) => c + PAGE_SIZE);
  }, []);

  // Reset pagination when channel changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [channelId]);

  // ─── Date separators ──────────────────────────────────────────
  const messagesWithDates = useMemo(() => {
    const visible = messages.slice(Math.max(0, messages.length - visibleCount));
    const result: (ChatMessage | { __dateSeparator: string })[] = [];
    let lastDate = "";
    for (const msg of visible) {
      const date = formatMessageDate(msg.sentAt);
      if (date !== lastDate) {
        result.push({ __dateSeparator: date });
        lastDate = date;
      }
      result.push(msg);
    }
    return result;
  }, [messages, visibleCount]);

  // ─── Loading state ────────────────────────────────────────────
  if (isLoading || !detail) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
        {channelError ? (
          <View className="items-center px-8">
            <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
            <Text className="mt-3 text-center text-base text-foreground">
              {channelError}
            </Text>
            <TouchableOpacity
              onPress={() => void fetchChannel(true)}
              className="mt-4 rounded-full px-6 py-2.5"
              style={{ backgroundColor: primaryColor }}
            >
              <Text className="font-semibold text-white">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ActivityIndicator color={primaryColor} size="large" />
        )}
      </View>
    );
  }

  const counterpartName = isAsker ? detail.acceptorName : detail.askerName;
  const counterpartImage = isAsker ? detail.acceptorImage : detail.askerImage;

  // ─── Render message ───────────────────────────────────────────
  const renderItem = ({ item }: { item: ChatMessage | { __dateSeparator: string } }) => {
    if ("__dateSeparator" in item) {
      return (
        <View className="my-3 items-center">
          <View className="bg-muted/30 rounded-full px-3 py-1">
            <Text className="text-[11px] font-medium text-muted-foreground">
              {item.__dateSeparator}
            </Text>
          </View>
        </View>
      );
    }

    const msg = item;
    if (msg.isDeleted) {
      return (
        <View className="my-1 items-center">
          <View className="bg-muted/20 flex-row items-center gap-1.5 rounded-full px-3 py-1.5">
            <Ionicons name="trash-outline" size={12} color={mutedIconColor} />
            <Text className="text-[11px] text-muted-foreground">Message deleted</Text>
          </View>
        </View>
      );
    }

    if (msg.isSystemMessage) {
      return (
        <View className="my-2 items-center px-12">
          <View className="rounded-2xl bg-sky-500/10 px-4 py-2.5">
            <Text className="text-center text-[13px] leading-5 text-sky-700 dark:text-sky-300">
              {msg.content}
            </Text>
          </View>
        </View>
      );
    }

    const isOwn = msg.isOwn || msg.senderId === userId;
    const showMark = isAcceptor && isActive && isOwn && !detail.isAnswerSubmitted;

    return (
      <View className={`my-1 px-3 ${isOwn ? "items-end" : "items-start"}`}>
        <View
          style={{
            maxWidth: "80%",
            borderRadius: 18,
            padding: 10,
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
          {!isOwn ? (
            <Text
              className="mb-1 text-[11px] font-semibold"
              style={{ color: primaryColor }}
            >
              {msg.senderName}
            </Text>
          ) : null}

          {msg.mediaUrl ? (
            <Image
              source={{ uri: msg.mediaUrl }}
              style={{
                width: 200,
                height: 150,
                borderRadius: 12,
                marginBottom: msg.content ? 6 : 0,
              }}
              resizeMode="cover"
            />
          ) : null}

          {msg.content ? (
            <Text
              className="text-[15px] leading-[22px]"
              style={{ color: isOwn ? "#fff" : undefined }}
            >
              {msg.content}
            </Text>
          ) : null}

          <View className="mt-1 flex-row items-center justify-end gap-1.5">
            <Text
              className="text-[10px]"
              style={{ color: isOwn ? "rgba(255,255,255,0.6)" : mutedIconColor }}
            >
              {formatMessageTime(msg.sentAt)}
            </Text>
            {isOwn && msg.isSending ? (
              <ActivityIndicator size={8} color="rgba(255,255,255,0.5)" />
            ) : isOwn ? (
              <Ionicons
                name={msg.isDelivered ? "checkmark-done" : "checkmark"}
                size={12}
                color={msg.isSeen ? "#60a5fa" : "rgba(255,255,255,0.5)"}
              />
            ) : null}
          </View>

          {msg.sendFailed ? (
            <TouchableOpacity
              onPress={() => handleRetry(msg)}
              className="mt-1 flex-row items-center gap-1"
            >
              <Ionicons name="refresh" size={12} color="#ef4444" />
              <Text className="text-[11px] font-medium text-red-500">Tap to retry</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {showMark ? (
          <TouchableOpacity
            onPress={() => handleToggleMark(msg.id, msg.isMarkedAsAnswer)}
            className="mt-1 px-1"
          >
            <Ionicons
              name={msg.isMarkedAsAnswer ? "star" : "star-outline"}
              size={16}
              color={msg.isMarkedAsAnswer ? "#f59e0b" : mutedIconColor}
            />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  // ─── Rating Modal ─────────────────────────────────────────────
  const renderRatingModal = () => (
    <Modal
      visible={ratingModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setRatingModalVisible(false)}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          alignItems: "center",
        }}
        onPress={() => setRatingModalVisible(false)}
      >
        <Pressable
          onPress={() => {}}
          style={{
            width: "85%",
            backgroundColor: cardColor,
            borderRadius: 24,
            padding: 24,
          }}
        >
          <Text className="mb-2 text-center text-lg font-bold text-foreground">
            Rate this answer
          </Text>
          <Text className="mb-5 text-center text-sm text-muted-foreground">
            How would you rate the teacher&apos;s response?
          </Text>

          <View className="mb-6 flex-row items-center justify-center gap-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setSelectedRating(star)}>
                <Ionicons
                  name={star <= selectedRating ? "star" : "star-outline"}
                  size={36}
                  color={star <= selectedRating ? "#f59e0b" : mutedIconColor}
                />
              </TouchableOpacity>
            ))}
          </View>

          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => setRatingModalVisible(false)}
              className="flex-1 items-center rounded-xl border border-border py-3"
            >
              <Text className="font-semibold text-foreground">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!selectedRating || isClosing}
              onPress={handleClose}
              className="flex-1 items-center rounded-xl py-3"
              style={{
                backgroundColor: selectedRating ? primaryColor : `${primaryColor}55`,
              }}
            >
              {isClosing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="font-semibold text-white">Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {renderRatingModal()}

      {/* ── Header ──────────────────────────────────────────── */}
      <View
        style={{
          backgroundColor,
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
          paddingTop: Platform.OS === "ios" ? 54 : (StatusBar.currentHeight ?? 24) + 8,
          paddingBottom: 10,
          paddingHorizontal: 16,
        }}
      >
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={isDark ? "#fff" : "#111"} />
          </TouchableOpacity>

          {counterpartImage ? (
            <Image
              source={{ uri: counterpartImage }}
              className="h-9 w-9 rounded-full border border-border"
              resizeMode="cover"
            />
          ) : (
            <View
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: primarySoftColor }}
            >
              <Text className="text-sm font-bold" style={{ color: primaryColor }}>
                {counterpartName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
              {counterpartName}
            </Text>
            <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
              {detail.questionTitle}
            </Text>
          </View>

          {isActive ? (
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
                {detail.status === "CLOSED" ? "Closed" : detail.status}
              </Text>
            </View>
          )}
        </View>

        {/* Extend + Close buttons */}
        {isActive ? (
          <View className="mt-2 flex-row items-center gap-2">
            {canExtend ? (
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
            ) : null}

            {isAcceptor &&
            isActive &&
            !detail.isAnswerSubmitted &&
            markedMessageIds.length > 0 ? (
              <TouchableOpacity
                onPress={handleSubmitAnswer}
                className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
                style={{ backgroundColor: "#10b981" }}
              >
                <Ionicons name="checkmark-done-outline" size={14} color="#fff" />
                <Text className="text-[11px] font-semibold text-white">
                  Submit Answer
                </Text>
              </TouchableOpacity>
            ) : null}

            {isAsker && detail.isAnswerSubmitted ? (
              <TouchableOpacity
                onPress={() => {
                  setSelectedRating(0);
                  setRatingModalVisible(true);
                }}
                className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
                style={{ backgroundColor: primaryColor }}
              >
                <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                <Text className="text-[11px] font-semibold text-white">Close & Rate</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* ── Messages ────────────────────────────────────────── */}
      <FlatList
        ref={flatListRef}
        data={messagesWithDates}
        keyExtractor={(item, i) =>
          "__dateSeparator" in item
            ? `sep-${item.__dateSeparator}-${i}`
            : item.id || item.localId || `msg-${i}`
        }
        renderItem={renderItem as any}
        contentContainerStyle={{ paddingVertical: 8 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (!isLoadingOlderRef.current) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
          isLoadingOlderRef.current = false;
        }}
        ListHeaderComponent={
          messages.length > visibleCount ? (
            <TouchableOpacity
              onPress={handleLoadOlder}
              className="mx-auto my-3 flex-row items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2"
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-up-circle-outline" size={15} color={mutedIconColor} />
              <Text className="text-xs text-muted-foreground">Load older messages</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {/* ── Input bar ───────────────────────────────────────── */}
      {isActive ? (
        <View
          style={{
            backgroundColor,
            borderTopWidth: 1,
            borderTopColor: borderColor,
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: Platform.OS === "ios" ? 28 : 12,
          }}
        >
          <View className="flex-row items-end gap-2">
            <TouchableOpacity
              onPress={handlePickImage}
              className="mb-1 h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: primarySoftColor }}
            >
              <Ionicons name="image-outline" size={20} color={primaryColor} />
            </TouchableOpacity>

            <View
              className="flex-1 rounded-2xl border px-3 py-2"
              style={{ borderColor, backgroundColor: cardColor, maxHeight: 120 }}
            >
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Type a message..."
                placeholderTextColor={mutedIconColor}
                multiline
                className="text-[15px] text-foreground"
                style={{ textAlignVertical: "top", maxHeight: 100 }}
              />
            </View>

            <TouchableOpacity
              onPress={handleSend}
              disabled={!inputText.trim() || isSending}
              className="mb-1 h-10 w-10 items-center justify-center rounded-full"
              style={{
                backgroundColor: inputText.trim() ? primaryColor : `${primaryColor}55`,
              }}
            >
              {isSending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View
          style={{
            backgroundColor: cardColor,
            borderTopWidth: 1,
            borderTopColor: borderColor,
            paddingHorizontal: 16,
            paddingVertical: 14,
            paddingBottom: Platform.OS === "ios" ? 28 : 14,
          }}
        >
          <Text className="text-center text-sm text-muted-foreground">
            This channel is {detail.status.toLowerCase()}.
            {detail.ratingGiven ? ` Rated ${detail.ratingGiven}/5.` : ""}
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
