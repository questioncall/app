import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
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
import { Audio } from "expo-av";
import { router, useLocalSearchParams } from "expo-router";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useImageViewer } from "@/components/image-viewer/image-viewer-context";
import ChannelTimer from "@/components/channel/ChannelTimer";
import { MessageItem } from "@/components/channel/MessageItem";

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
import { markChannelRead, setActiveChannelId } from "@/store/slices/channelsSlice";
import {
  enqueueFailedMessage,
  dequeueMessage,
  getFailedMessages,
} from "@/lib/message-retry-queue";

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
  const messages = useMemo(() => cached?.messages ?? [], [cached?.messages]);
  const { openImageViewer } = useImageViewer();

  const isAsker = userId === detail?.askerId;
  const isAcceptor = userId === detail?.acceptorId;
  const isActive = detail?.status === "ACTIVE";

  const insets = useSafeAreaInsets();

  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const [questionBannerExpanded, setQuestionBannerExpanded] = useState(false);
  const [startingCallType, setStartingCallType] = useState<"AUDIO" | "VIDEO" | null>(
    null,
  );

  const flatListRef = useRef<FlatList<any>>(null);
  const isLoadingOlderRef = useRef(false);
  // Declared here with null; assigned after fetchChannel useCallback below
  // to avoid Temporal Dead Zone errors (fetchChannel is a const).
  const fetchChannelRef = useRef<(() => Promise<void>) | null>(null);
  // Set to true while a system permission dialog is in-flight (camera /
  // microphone). The dialog briefly triggers AppState → active, which would
  // cause a spurious full DB reload; we skip that refetch while this is set.
  const suppressForegroundRefetchRef = useRef(false);

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
        // Diagnostic: log questionImages so we can verify the API is returning them.
        console.warn(
          `[workspace] channel API questionImages for ${channelId}:`,
          channel?.questionImages,
        );
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
        // Normalize the detail so stale cache entries that pre-date the
        // questionImages field never break the banner (rehydrated entries
        // from redux-persist may have questionImages === undefined).
        const normalizedDetail: ChannelDetail = {
          ...(channel as ChannelDetail),
          questionImages: Array.isArray(channel?.questionImages)
            ? channel.questionImages
            : [],
        };
        dispatch(
          setChannelData({
            channelId,
            detail: normalizedDetail,
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
  fetchChannelRef.current = fetchChannel;

  const cachedRef = useRef(cached);
  cachedRef.current = cached;

  useEffect(() => {
    if (!channelId) return;
    const isFresh =
      cachedRef.current && Date.now() - cachedRef.current.fetchedAt < CACHE_TTL_MS;
    if (isFresh && cachedRef.current) {
      const cachedDetail = cachedRef.current.detail;
      // If this cache entry pre-dates the questionImages field (redux-persist
      // rehydration of old data), force a fresh fetch instead of serving
      // stale data that would make the banner show "No images attached."
      if (!Array.isArray(cachedDetail.questionImages)) {
        fetchChannelRef.current?.();
      } else {
        dispatch(
          setChannelData({
            channelId,
            detail: cachedDetail,
            messages: cachedRef.current.messages,
          }),
        );
      }
    } else if (fetchChannelRef.current) {
      fetchChannelRef.current();
    }
    return () => {
      dispatch(clearChannel());
    };
  }, [channelId, dispatch]);

  // ─── Track active channel so the realtime bridge skips incrementing unread ──
  useEffect(() => {
    if (!channelId) return;
    dispatch(setActiveChannelId(channelId));
    return () => {
      dispatch(setActiveChannelId(null));
    };
  }, [channelId, dispatch]);

  // ─── Mark as read on mount ─────────────────────────────────────
  useEffect(() => {
    if (!channelId || !detail) return;
    api.post(`/channels/${channelId}/read`).catch(() => {});
    dispatch(markChannelRead(channelId));
    dispatch(markMessagesAsSeen());
  }, [channelId, detail, dispatch]);

  // ─── Pusher subscription ───────────────────────────────────────
  useEffect(() => {
    if (!channelId) return;
    const client = getPusherClient();
    if (!client) return;

    console.log(
      `[workspace] Subscribing to Pusher channel=${getChannelPusherName(channelId)}`,
    );

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
      console.log(
        `[workspace] CHANNEL_MESSAGE_EVENT received: id=${normalized.id} sender=${normalized.senderId} isOwn=${normalized.isOwn} channelId=${normalized.channelId}`,
      );
      if (!normalized.isOwn) {
        dispatch(appendMessage(normalized));
        api.post(`/channels/${channelId}/read`).catch(() => {});
        dispatch(markChannelRead(channelId));
      } else {
        console.log(`[workspace] Skipping own message from Pusher`);
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

    // Listen for Pusher reconnection to re-fetch (uses ref to avoid effect churn)
    const onReconnect = () => {
      console.log(
        `[workspace] Pusher reconnected — re-fetching messages for channelId=${channelId}`,
      );
      void fetchChannelRef.current!();
    };
    client.connection.bind("connected", onReconnect);

    return () => {
      pusherChannel.unbind_all();
      client.unsubscribe(getChannelPusherName(channelId));
      client.connection.unbind("connected", onReconnect);
    };
  }, [channelId, userId, dispatch]);

  // ─── Re-fetch on app foreground to recover missed messages ────
  useEffect(() => {
    if (!channelId) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        // Skip if we triggered the inactive→active transition ourselves by
        // opening a system permission dialog (camera / microphone / gallery).
        if (suppressForegroundRefetchRef.current) return;
        // Skip if the cached data is still fresh — avoids a full-screen
        // spinner and a redundant DB round-trip when the user briefly
        // minimises the app and immediately returns.
        const cache = cachedRef.current;
        if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return;
        // Re-fetch silently (force = true skips the loading spinner) so the
        // UI doesn't flash white while the request is in-flight.
        void fetchChannelRef.current!(true);
      }
    });
    return () => {
      subscription.remove();
    };
  }, [channelId]);

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

  // ─── Take photo with camera ────────────────────────────────────
  const handleOpenCamera = async () => {
    if (!isActive) return;
    suppressForegroundRefetchRef.current = true;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    suppressForegroundRefetchRef.current = false;
    if (!permission.granted) {
      Toast.show({ type: "error", text1: "Camera permission required." });
      return;
    }
    suppressForegroundRefetchRef.current = true;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.85,
    });
    suppressForegroundRefetchRef.current = false;
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const isVideo = asset.type === "video";
    const localId = `local_cam_${Date.now()}`;
    const optimistic: ChatMessage = {
      id: localId,
      localId,
      channelId: channelId!,
      senderId: userId!,
      senderName: "You",
      content: "",
      mediaUrl: asset.uri,
      mediaType: isVideo ? "VIDEO" : "image",
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
        name: asset.fileName ?? `cam-${Date.now()}.${isVideo ? "mp4" : "jpg"}`,
        type: asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg"),
      } as unknown as Blob);
      const uploadRes = await api.post("/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      });
      const mediaUrl = uploadRes.data?.secure_url ?? uploadRes.data?.url;

      const res = await api.post(`/channels/${channelId}/messages`, {
        mediaUrl,
        mediaType: isVideo ? "VIDEO" : "IMAGE",
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
      Toast.show({ type: "error", text1: "Failed to send photo" });
    }
  };

  // ─── Send image ────────────────────────────────────────────────
  const handlePickImage = async () => {
    if (!isActive) return;
    suppressForegroundRefetchRef.current = true;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    suppressForegroundRefetchRef.current = false;
    if (!permission.granted) {
      Toast.show({ type: "error", text1: "Photo library permission required." });
      return;
    }
    suppressForegroundRefetchRef.current = true;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    suppressForegroundRefetchRef.current = false;
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
        mediaType: "IMAGE",
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
  const handleToggleMark = useCallback(
    async (messageId: string, currentMark: boolean) => {
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
    },
    [channelId, dispatch],
  );

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
  const handleRetry = useCallback(
    async (msg: ChatMessage) => {
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
    },
    [channelId, dispatch],
  );

  // ─── Voice recording implementation (expo-av) ──────────────────
  const recordingRef = useRef<Audio.Recording | null>(null);
  const playbackRef = useRef<Audio.Sound | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [pendingAudio, setPendingAudio] = useState<{
    uri: string;
    duration: number;
  } | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const startVoiceRecording = async () => {
    if (isRecording) return;
    try {
      suppressForegroundRefetchRef.current = true;
      const { granted } = await Audio.requestPermissionsAsync();
      suppressForegroundRefetchRef.current = false;
      if (!granted) {
        Toast.show({ type: "error", text1: "Microphone permission required" });
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to start recording",
        text2: String(err),
      });
    }
  };

  const stopVoiceRecording = async () => {
    if (!isRecording || !recordingRef.current) return;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    const duration = recordingDuration;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      setRecordingDuration(0);
      if (uri) {
        setPendingAudio({ uri, duration });
      }
    } catch {
      recordingRef.current = null;
      setIsRecording(false);
      setRecordingDuration(0);
      Toast.show({ type: "error", text1: "Failed to stop recording" });
    }
  };

  const togglePreviewPlayback = async () => {
    if (!pendingAudio) return;
    if (isPlayingPreview && playbackRef.current) {
      await playbackRef.current.stopAsync().catch(() => {});
      await playbackRef.current.unloadAsync().catch(() => {});
      playbackRef.current = null;
      setIsPlayingPreview(false);
      return;
    }
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: pendingAudio.uri },
        { shouldPlay: true },
      );
      playbackRef.current = sound;
      setIsPlayingPreview(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          setIsPlayingPreview(false);
          void sound.unloadAsync();
          playbackRef.current = null;
        }
      });
    } catch {
      Toast.show({ type: "error", text1: "Failed to play preview" });
    }
  };

  const cancelPendingAudio = async () => {
    if (playbackRef.current) {
      await playbackRef.current.stopAsync().catch(() => {});
      await playbackRef.current.unloadAsync().catch(() => {});
      playbackRef.current = null;
    }
    setIsPlayingPreview(false);
    setPendingAudio(null);
  };

  const formatRecordingTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  const sendVoiceMessage = async (audioUri: string) => {
    if (!isActive) return;
    const localId = `local_audio_${Date.now()}`;
    const optimistic: ChatMessage = {
      id: localId,
      localId,
      channelId: channelId!,
      senderId: userId!,
      senderName: "You",
      content: "",
      mediaUrl: audioUri,
      mediaType: "AUDIO",
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
        uri: audioUri,
        name: `voice-${Date.now()}.m4a`,
        type: "audio/m4a",
      } as unknown as Blob);
      const uploadRes = await api.post("/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 30000,
      });
      const mediaUrl = uploadRes.data?.secure_url ?? uploadRes.data?.url;

      const res = await api.post(`/channels/${channelId}/messages`, {
        mediaUrl,
        mediaType: "AUDIO",
      });
      dispatch(
        resolvePendingMessage({
          localId,
          message: { ...(res.data as ChatMessage), isOwn: true, isDelivered: true },
        }),
      );
      dequeueMessage(localId).catch(() => {});
      Toast.show({ type: "success", text1: "Voice message sent" });
    } catch {
      dispatch(failPendingMessage(localId));
      enqueueFailedMessage(optimistic).catch(() => {});
      Toast.show({ type: "error", text1: "Failed to send voice message" });
    }
  };

  // ─── Start call ───────────────────────────────────────────────
  const handleStartCall = async (mode: "AUDIO" | "VIDEO") => {
    if (!channelId || startingCallType) return;
    setStartingCallType(mode);
    try {
      const res = await api.post("/calls/create", { channelId, mode });
      const callSessionId = res.data?.callSessionId ?? res.data?.id;
      if (callSessionId) {
        router.push(`/call/${callSessionId}` as any);
      }
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1: err?.response?.data?.error ?? "Failed to start call",
      });
    } finally {
      setStartingCallType(null);
    }
  };

  // ─── Voice record toggle ──────────────────────────────────────
  const handleVoiceRecord = () => {
    if (isRecording) {
      void stopVoiceRecording();
    } else {
      void startVoiceRecording();
    }
  };

  // ─── Send pending audio ───────────────────────────────────────
  const handleSendPendingAudio = async () => {
    if (!pendingAudio || !isActive) return;
    const { uri } = pendingAudio;
    await cancelPendingAudio();
    await sendVoiceMessage(uri);
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

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage | { __dateSeparator: string } }) => (
      <MessageItem
        item={item}
        userId={userId}
        isAcceptor={isAcceptor}
        isActive={isActive}
        isAnswerSubmitted={!!detail?.isAnswerSubmitted}
        primaryColor={primaryColor}
        cardColor={cardColor}
        borderColor={borderColor}
        mutedIconColor={mutedIconColor}
        formatMessageTime={formatMessageTime}
        onImageOpen={openImageViewer}
        onRetry={handleRetry}
        onToggleMark={handleToggleMark}
      />
    ),
    [
      userId,
      isAcceptor,
      isActive,
      detail?.isAnswerSubmitted,
      primaryColor,
      cardColor,
      borderColor,
      mutedIconColor,
      openImageViewer,
      handleRetry,
      handleToggleMark,
    ],
  );

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
      behavior="padding"
      className="flex-1 bg-background"
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
    >
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {renderRatingModal()}

      {/* ── Header ──────────────────────────────────────────── */}
      <View
        style={{
          backgroundColor,
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
          paddingTop:
            Platform.OS === "ios"
              ? Math.max(insets.top, 44)
              : (StatusBar.currentHeight ?? 0) + 8,
          paddingBottom: 10,
          paddingHorizontal: 16,
        }}
      >
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/(tabs)" as any)
            }
            hitSlop={12}
          >
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
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={() => handleStartCall("AUDIO")}
                disabled={!!startingCallType}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: primarySoftColor,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {startingCallType === "AUDIO" ? (
                  <ActivityIndicator size={14} color={primaryColor} />
                ) : (
                  <Ionicons name="call-outline" size={16} color={primaryColor} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleStartCall("VIDEO")}
                disabled={!!startingCallType}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: primarySoftColor,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {startingCallType === "VIDEO" ? (
                  <ActivityIndicator size={14} color={primaryColor} />
                ) : (
                  <Ionicons name="videocam-outline" size={16} color={primaryColor} />
                )}
              </TouchableOpacity>
              <ChannelTimer
                timerDeadline={detail?.timerDeadline ?? null}
                channelId={channelId}
                isActive={isActive}
                isAnswerSubmitted={!!detail?.isAnswerSubmitted}
                timeExtensionCount={detail?.timeExtensionCount ?? 0}
                primaryColor={primaryColor}
              />
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

      {/* ── Answer submitted banner (asker view) ────────────── */}
      {isAsker && detail.isAnswerSubmitted && isActive && (
        <View
          style={{
            backgroundColor: "#10b98115",
            borderBottomWidth: 1,
            borderBottomColor: "#10b98130",
            paddingHorizontal: 16,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Ionicons name="checkmark-circle" size={16} color="#10b981" />
          <Text style={{ fontSize: 13, color: "#10b981", fontWeight: "500", flex: 1 }}>
            Teacher submitted an answer — review and close the channel when ready.
          </Text>
        </View>
      )}

      {/* ── Question context banner ─────────────────────────── */}
      {/* Collapsed by default — tap to expand and see the question title +
          the images the student attached when posting the question.           */}
      {detail.questionTitle ? (
        <View
          style={{
            backgroundColor: isDark ? "#1e293b" : "#f0f9ff",
            borderBottomWidth: 1,
            borderBottomColor: isDark ? "#334155" : "#bae6fd",
          }}
        >
          {/* Always-visible header row — tap to expand / collapse */}
          <TouchableOpacity
            onPress={() => setQuestionBannerExpanded((v) => !v)}
            activeOpacity={0.8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 14,
              paddingVertical: 8,
              gap: 8,
            }}
          >
            <Ionicons name="help-circle" size={15} color={primaryColor} />
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontSize: 12,
                fontWeight: "600",
                color: isDark ? "#e2e8f0" : "#0f172a",
              }}
            >
              {detail.questionTitle}
            </Text>
            <Ionicons
              name={questionBannerExpanded ? "chevron-up" : "chevron-down"}
              size={14}
              color={mutedIconColor}
            />
          </TouchableOpacity>

          {/* Expanded: only images posted with the question */}
          {questionBannerExpanded ? (
            <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
              {Array.isArray(detail.questionImages) &&
              detail.questionImages.length > 0 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {detail.questionImages.map((uri, idx) => (
                    <TouchableOpacity key={idx} onPress={() => openImageViewer(uri)}>
                      <Image
                        source={{ uri }}
                        style={{ width: 80, height: 80, borderRadius: 10 }}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={{ fontSize: 12, color: mutedIconColor }}>
                  No images attached to this question.
                </Text>
              )}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── Messages ────────────────────────────────────────── */}
      <FlatList
        ref={flatListRef}
        data={messagesWithDates}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
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
            paddingBottom: Math.max(insets.bottom, Platform.OS === "ios" ? 20 : 8) + 4,
          }}
        >
          {/* ── Recording in progress ── */}
          {isRecording ? (
            <View className="flex-row items-center gap-3 px-2 py-1">
              <View className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <Text className="flex-1 font-mono text-base text-red-500">
                Recording {formatRecordingTime(recordingDuration)}
              </Text>
              <TouchableOpacity
                onPress={handleVoiceRecord}
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: primaryColor }}
              >
                <Ionicons name="stop" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : pendingAudio ? (
            /* ── Audio preview ── */
            <View className="flex-row items-center gap-2 px-1 py-1">
              <TouchableOpacity
                onPress={togglePreviewPlayback}
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: primarySoftColor }}
              >
                <Ionicons
                  name={isPlayingPreview ? "pause" : "play"}
                  size={20}
                  color={primaryColor}
                />
              </TouchableOpacity>
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground">Voice message</Text>
                <Text className="text-xs text-muted-foreground">
                  {formatRecordingTime(pendingAudio.duration)}
                </Text>
              </View>
              {/* Delete */}
              <TouchableOpacity
                onPress={cancelPendingAudio}
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: isDark ? "#3f1212" : "#fee2e2" }}
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
              {/* Send */}
              <TouchableOpacity
                onPress={handleSendPendingAudio}
                disabled={isSending}
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: primaryColor }}
              >
                {isSending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="send" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* ── Normal input ── */
            <View className="flex-row items-end gap-2">
              {/* Gallery picker */}
              <TouchableOpacity
                onPress={handlePickImage}
                className="mb-1 h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: primarySoftColor }}
              >
                <Ionicons name="image-outline" size={20} color={primaryColor} />
              </TouchableOpacity>
              {/* Camera */}
              <TouchableOpacity
                onPress={handleOpenCamera}
                className="mb-1 h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: primarySoftColor }}
              >
                <Ionicons name="camera-outline" size={20} color={primaryColor} />
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
                onPress={inputText.trim() ? handleSend : handleVoiceRecord}
                disabled={isSending}
                className="mb-1 h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: primaryColor }}
              >
                {isSending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : inputText.trim() ? (
                  <Ionicons name="send" size={18} color="#fff" />
                ) : (
                  <Ionicons name="mic-outline" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View
          style={{
            backgroundColor: cardColor,
            borderTopWidth: 1,
            borderTopColor: borderColor,
            paddingHorizontal: 16,
            paddingVertical: 14,
            paddingBottom: Math.max(insets.bottom, Platform.OS === "ios" ? 20 : 8) + 6,
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
