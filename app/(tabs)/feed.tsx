import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated as RNAnimated,
  Easing,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import Toast from "react-native-toast-message";

import { AuthNotice } from "@/components/auth/auth-notice";
import { useImageViewer } from "@/components/image-viewer/image-viewer-context";
import { InlineVideo } from "@/components/media/inline-video";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { useAppTheme } from "@/hooks/use-app-theme";
import { api, publicApi } from "@/lib/api";
import { scheduleAnswerDeadlineReminder } from "@/lib/local-notifications";
import { getMediaKind } from "@/lib/media-helpers";
import {
  getPusherClient,
  QUESTION_CREATED_EVENT,
  QUESTION_FEED_CHANNEL,
  QUESTION_UPDATED_EVENT,
} from "@/lib/realtime";
import { store } from "@/store";
import {
  addMyQuestion,
  appendQuestions,
  clearFeedError,
  getFeedQuestionId,
  normalizeFeedQuestion,
  normalizeFeedQuestions,
  prependQuestion,
  removeQuestion,
  selectIsFeedStale,
  setFeedError,
  setFeedLoading,
  setFeedLoadingMore,
  setFeedRefreshing,
  setHasMore,
  setMyQuestions,
  setQuestions,
  updateQuestion,
} from "@/store/slices/feedSlice";
import { updateUser } from "@/store/slices/userSlice";
import {
  selectIsCoursesStale,
  setCourses,
  setCoursesError,
  setCoursesLoading,
  setCoursesRefreshing,
} from "@/store/slices/coursesSlice";
import type { Course } from "@/store/slices/coursesSlice";
import type { FeedQuestion, ReactionType } from "@/types/question";

type IoniconName = ComponentProps<typeof Ionicons>["name"];
type FeedView = "all" | "waiting" | "solved" | "media" | "discussion";
type FeedSort = "hot" | "new" | "discussed";

type PeerCommentItem = {
  _id: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  studentId?: {
    _id?: string;
    name?: string;
    userImage?: string | null;
    username?: string;
  } | null;
};

const FEED_VIEW_OPTIONS: { value: FeedView; label: string; icon: IoniconName }[] = [
  { value: "all", label: "All", icon: "apps-outline" },
  { value: "waiting", label: "Waiting", icon: "hourglass-outline" },
  { value: "solved", label: "Solved", icon: "checkmark-done-outline" },
  { value: "media", label: "Media", icon: "images-outline" },
  { value: "discussion", label: "Discussion", icon: "chatbubbles-outline" },
];

const FEED_SORT_OPTIONS: { value: FeedSort; label: string; icon: IoniconName }[] = [
  { value: "hot", label: "Hot", icon: "flame-outline" },
  { value: "new", label: "New", icon: "time-outline" },
  { value: "discussed", label: "Discussed", icon: "chatbubble-ellipses-outline" },
];

const REACTION_BUTTONS: {
  type: ReactionType;
  label: string;
  icon: IoniconName;
  activeIcon: IoniconName;
}[] = [
  { type: "like", label: "Like", icon: "heart-outline", activeIcon: "heart" },
  { type: "insightful", label: "Insightful", icon: "bulb-outline", activeIcon: "bulb" },
  {
    type: "same_doubt",
    label: "Same doubt",
    icon: "help-circle-outline",
    activeIcon: "help-circle",
  },
];

const COURSE_FALLBACK_COLORS = ["#0A8A4B", "#0F766E", "#C2410C", "#BE123C"];

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

function formatTimeAgo(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "just now";
  const minutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatCoursePrice(course: Course) {
  if (course.pricingModel === "FREE") return "Free";
  if (course.pricingModel === "SUBSCRIPTION_INCLUDED") return "Sub";
  if (typeof course.price === "number" && Number.isFinite(course.price)) {
    return `NPR ${course.price.toLocaleString()}`;
  }
  return "Paid";
}

function getQuestionKey(item: FeedQuestion, index: number) {
  return `${getFeedQuestionId(item) || item.createdAt || item.title || "question"}-${index}`;
}

function dedupeComments(comments: PeerCommentItem[]) {
  const unique = new Map<string, PeerCommentItem>();
  for (const comment of comments) {
    if (comment?._id) unique.set(comment._id, comment);
  }
  return Array.from(unique.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function getReactionSummary(question: FeedQuestion) {
  const summary = { like: 0, insightful: 0, same_doubt: 0 };
  for (const reaction of question.reactions) {
    if (reaction.type in summary) summary[reaction.type] += 1;
  }
  return { ...summary, total: question.reactions.length };
}

function hasMediaQuestion(question: FeedQuestion) {
  return (
    (question.images?.length ?? 0) > 0 ||
    (question.answer?.mediaUrls?.length ?? 0) > 0 ||
    question.answerFormat.includes("PHOTO") ||
    question.answerFormat.includes("VIDEO") ||
    question.answerFormat.includes("AUDIO")
  );
}

function matchesAllTerms(haystack: string, query: string): boolean {
  const terms = query.split(/\s+/).filter(Boolean);
  return terms.every((term) => haystack.includes(term));
}

function matchesQuestionSearch(question: FeedQuestion, query: string) {
  if (!query) return true;
  const haystack = [
    question.title,
    question.body,
    question.subject,
    question.stream,
    question.level,
    question.askerName,
    question.askerUsername,
    question.previewAuthor,
    question.previewText,
    question.acceptedByName,
    question.answer?.content,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return matchesAllTerms(haystack, query);
}

function matchesCourseSearch(course: Course, query: string) {
  if (!query) return true;
  const haystack = [
    course.title,
    course.subject,
    course.level,
    course.instructorName,
    course.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return matchesAllTerms(haystack, query);
}

function normalizeQuestionCards(questions: FeedQuestion[]) {
  return [...questions];
}

// ─── Inline audio player used inside AnswerDetails ─────────────────────────
function AnswerAudioPlayer({
  uri,
  borderColor,
  primaryColor,
  mutedIconColor,
}: {
  uri: string;
  borderColor: string;
  primaryColor: string;
  mutedIconColor: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const isPlaying = status.playing;

  useEffect(() => {
    if (status.didJustFinish) {
      player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  useEffect(() => {
    return () => {
      player.remove();
    };
  }, [player]);

  const handleToggle = async () => {
    if (isPlaying) {
      player.pause();
      return;
    }
    setIsLoading(true);
    try {
      await setAudioModeAsync({ playsInSilentMode: true });
      player.play();
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  const filename = uri.split("/").pop()?.split("?")[0] ?? "Audio";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderWidth: 1,
        borderColor,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginRight: 8,
        minWidth: 180,
        maxWidth: 240,
      }}
    >
      <TouchableOpacity
        onPress={handleToggle}
        disabled={isLoading}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: `${primaryColor}18`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={primaryColor} />
        ) : (
          <Ionicons name={isPlaying ? "pause" : "play"} size={16} color={primaryColor} />
        )}
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontSize: 12, fontWeight: "600", color: undefined }}
          className="text-foreground"
          numberOfLines={1}
        >
          {filename}
        </Text>
        <Text style={{ fontSize: 11, color: mutedIconColor, marginTop: 1 }}>
          {isPlaying ? "Playing…" : "Tap to play"}
        </Text>
      </View>
      <Ionicons name="musical-note-outline" size={14} color={mutedIconColor} />
    </View>
  );
}

function AnswerDetails({
  item,
  primaryColor,
  mutedIconColor,
  borderColor,
  onImagePress,
}: {
  item: FeedQuestion;
  primaryColor: string;
  mutedIconColor: string;
  borderColor: string;
  onImagePress: (url: string) => void;
}) {
  const mediaUrls = item.answer?.mediaUrls ?? [];

  // Split by kind so videos/images stay in a horizontal strip,
  // audio and docs render as full-width rows.
  const visualMedia = mediaUrls.filter((u) => {
    const k = getMediaKind(u);
    return k === "image" || k === "video";
  });
  const audioMedia = mediaUrls.filter((u) => getMediaKind(u) === "audio");
  const docMedia = mediaUrls.filter((u) => getMediaKind(u) === "document");

  return (
    <View className="border-t border-emerald-500/15 px-3 py-3">
      {item.answer?.content ? (
        <Text className="text-[15px] leading-7 text-foreground">
          {item.answer.content}
        </Text>
      ) : null}

      {/* ── Images + Videos (horizontal strip) ── */}
      {visualMedia.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-2"
          contentContainerStyle={{ paddingRight: 4 }}
        >
          {visualMedia.map((url, i) => (
            <View key={i} style={{ marginRight: 8 }}>
              {getMediaKind(url) === "video" ? (
                <InlineVideo
                  uri={url}
                  width={200}
                  height={140}
                  borderColor={borderColor}
                />
              ) : (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => onImagePress(url)}
                  className="overflow-hidden rounded-xl border border-border"
                >
                  <Image source={{ uri: url }} className="h-28 w-40" resizeMode="cover" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      ) : null}

      {/* ── Audio files ── */}
      {audioMedia.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-2"
          contentContainerStyle={{ paddingRight: 4 }}
        >
          {audioMedia.map((url, i) => (
            <AnswerAudioPlayer
              key={i}
              uri={url}
              borderColor={borderColor}
              primaryColor={primaryColor}
              mutedIconColor={mutedIconColor}
            />
          ))}
        </ScrollView>
      ) : null}

      {/* ── Documents ── */}
      {docMedia.length > 0 ? (
        <View className="mt-2 gap-2">
          {docMedia.map((url, i) => {
            const filename = url.split("/").pop()?.split("?")[0] ?? "Document";
            const ext = filename.split(".").pop()?.toUpperCase() ?? "FILE";
            return (
              <TouchableOpacity
                key={i}
                onPress={() => Linking.openURL(url).catch(() => {})}
                activeOpacity={0.7}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  borderWidth: 1,
                  borderColor,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: `${primaryColor}15`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="document-outline" size={18} color={primaryColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    className="text-[13px] font-semibold text-foreground"
                    numberOfLines={1}
                  >
                    {filename}
                  </Text>
                  <Text style={{ fontSize: 11, color: mutedIconColor, marginTop: 1 }}>
                    {ext} · Tap to open
                  </Text>
                </View>
                <Ionicons name="open-outline" size={14} color={mutedIconColor} />
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      <View className="mt-3 flex-row items-center gap-1.5 border-t border-emerald-500/15 pt-2.5">
        <Ionicons name="person-circle-outline" size={13} color={mutedIconColor} />
        <Text className="text-[11px] text-muted-foreground">
          Solved by{" "}
          <Text className="font-semibold text-foreground">
            {item.answer?.acceptorName || item.acceptedByName || "Teacher"}
          </Text>
          {item.answer?.submittedAt ? ` · ${formatTimeAgo(item.answer.submittedAt)}` : ""}
        </Text>
        {typeof item.answer?.rating === "number" ? (
          <View className="ml-auto flex-row items-center gap-0.5">
            <Ionicons name="star" size={11} color="#F59E0B" />
            <Text className="text-[11px] text-muted-foreground">
              {Number(item.answer.rating).toFixed(1)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ─── App Logo Component ────────────────────────────────────────────
function AppLogo() {
  return (
    <View className="flex-row items-center gap-2">
      <Image
        source={require("../../assets/images/logo.png")}
        style={{ width: 42, height: 28 }}
        resizeMode="contain"
      />
      <Text className="text-[18px] font-bold tracking-tight text-foreground">
        QuestionCall
      </Text>
    </View>
  );
}

export default function FeedScreen() {
  const dispatch = useAppDispatch();
  const { openImageViewer } = useImageViewer();
  const user = useAppSelector((state) => state.user.data);
  const feedState = useAppSelector((state) => state.feed);
  const coursesState = useAppSelector((state) => state.courses);
  const {
    statusBarStyle,
    backgroundColor,
    cardColor,
    borderColor,
    iconColor,
    mutedIconColor,
    primaryColor,
    primarySoftColor,
  } = useAppTheme();

  const userRole = user?.role;
  const isTeacher = userRole === "TEACHER";
  const roleKey = userRole ?? null;
  const userId = user?._id ?? null;
  const defaultSort: FeedSort = "new";

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [activeView, setActiveView] = useState<FeedView>("all");
  const [activeSort, setActiveSort] = useState<FeedSort>(defaultSort);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set());
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentsMap, setCommentsMap] = useState<Record<string, PeerCommentItem[]>>({});
  const [commentInput, setCommentInput] = useState<Record<string, string>>({});
  const [isSubmittingComment, setIsSubmittingComment] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal slide-up animation
  const modalSlide = useRef(new RNAnimated.Value(0)).current;

  // Debounce search: wait 300ms after user stops typing before filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // FlatList ref — used to auto-scroll to top when a new question is prepended
  // (own post, or other people's posts arriving via Pusher).
  const flatListRef = useRef<FlatList<FeedQuestion>>(null);
  const scrollToTop = useCallback((animated = true) => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated });
  }, []);

  const openFilterModal = useCallback(() => {
    setFilterModalVisible(true);
    RNAnimated.spring(modalSlide, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, []);

  const closeFilterModal = () => {
    RNAnimated.timing(modalSlide, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setFilterModalVisible(false));
  };

  const feedQuestions = normalizeQuestionCards(feedState.questions);
  const courseList = coursesState.list;
  const normalizedSearch = debouncedSearchTerm.trim().toLowerCase();
  const hasActiveFilters =
    normalizedSearch.length > 0 || activeView !== "all" || activeSort !== defaultSort;
  const isInitialFeedLoading = feedState.isLoading && feedQuestions.length === 0;
  const isRefreshing = feedState.isRefreshing || coursesState.isRefreshing;

  const activeFilterCount =
    (activeView !== "all" ? 1 : 0) + (activeSort !== defaultSort ? 1 : 0);

  useEffect(() => {
    setActiveSort(defaultSort);
  }, [defaultSort]);

  const FEED_PAGE_SIZE = 20;

  const loadFeed = useCallback(
    async (force = false) => {
      const currentFeedState = store.getState().feed;
      const currentCacheMatchesUser =
        currentFeedState.loadedForRole === roleKey &&
        currentFeedState.loadedForUserId === userId;
      const currentShouldUseCache =
        currentCacheMatchesUser && !selectIsFeedStale(currentFeedState.lastFetchedAt);
      if (!force && (currentFeedState.isLoading || currentShouldUseCache)) return;

      dispatch(setFeedLoading(true));
      dispatch(clearFeedError());
      try {
        const client = userId ? api : publicApi;
        const res = await client.get(`/questions/feed?limit=${FEED_PAGE_SIZE}`);
        const raw = Array.isArray(res.data) ? res.data : [];
        const normalized = normalizeFeedQuestions(raw);
        dispatch(setQuestions({ questions: normalized, role: roleKey, userId }));
        dispatch(setHasMore(raw.length >= FEED_PAGE_SIZE));
        dispatch(
          setMyQuestions(userId ? normalized.filter((q) => q.askerId === userId) : []),
        );
      } catch (err: unknown) {
        const error = err as {
          code?: string;
          message?: string;
          response?: { status?: number; data?: { error?: string; message?: string } };
        };
        const isNetworkError =
          error?.code === "ECONNABORTED" ||
          error?.code === "ERR_NETWORK" ||
          (typeof error?.message === "string" &&
            error.message.toLowerCase().includes("network"));
        const fallback = isNetworkError
          ? "Can't reach the server. Check your connection and try again."
          : error?.response?.status && error.response.status >= 500
            ? "The server hit an error loading the feed. Please retry shortly."
            : "Unable to load questions right now.";
        dispatch(
          setFeedError(
            error?.response?.data?.error ?? error?.response?.data?.message ?? fallback,
          ),
        );
      } finally {
        dispatch(setFeedLoading(false));
      }
    },
    [dispatch, roleKey, userId],
  );

  const loadMore = useCallback(async () => {
    const currentFeedState = store.getState().feed;
    if (currentFeedState.isLoadingMore || !currentFeedState.hasMore) return;
    const questions = currentFeedState.questions;
    if (questions.length === 0) return;

    const lastQuestion = questions[questions.length - 1];
    const cursor = lastQuestion.createdAt;
    if (!cursor) return;

    dispatch(setFeedLoadingMore(true));
    try {
      const client = userId ? api : publicApi;
      const res = await client.get(
        `/questions/feed?cursor=${encodeURIComponent(cursor)}&limit=${FEED_PAGE_SIZE}`,
      );
      const raw = Array.isArray(res.data) ? res.data : [];
      const normalized = normalizeFeedQuestions(raw);
      if (normalized.length > 0) {
        dispatch(appendQuestions(normalized));
        if (userId) {
          const myNew = normalized.filter((q) => q.askerId === userId);
          for (const q of myNew) dispatch(addMyQuestion(q));
        }
      }
      dispatch(setHasMore(raw.length >= FEED_PAGE_SIZE));
    } catch {
      // silent — user can pull-to-refresh
    } finally {
      dispatch(setFeedLoadingMore(false));
    }
  }, [dispatch, userId]);

  const loadCourses = useCallback(
    async (force = false) => {
      const currentCoursesState = store.getState().courses;
      const currentShouldUseCache = !selectIsCoursesStale(
        currentCoursesState.lastFetchedAt,
      );
      if (!force && (currentCoursesState.isLoading || currentShouldUseCache)) return;

      dispatch(setCoursesLoading(true));
      try {
        const res = await publicApi.get("/courses");
        const courses = Array.isArray(res.data?.courses)
          ? res.data.courses
          : Array.isArray(res.data)
            ? res.data
            : [];
        dispatch(setCourses(courses));
      } catch {
        dispatch(setCoursesError("Unable to load courses right now."));
      }
    },
    [dispatch],
  );

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);
  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    const client = getPusherClient();
    if (!client) return;
    const channel = client.subscribe(QUESTION_FEED_CHANNEL);

    const handleCreated = (payload: { question?: unknown }) => {
      if (!payload.question) return;
      const normalized = normalizeFeedQuestion(payload.question);
      dispatch(prependQuestion(normalized));
      if (normalized.askerId === userId) dispatch(addMyQuestion(normalized));
      // Surface the new question by pulling the list to the top.
      // Same behavior for student and teacher.
      scrollToTop();
    };

    const handleUpdated = (payload: { question?: unknown }) => {
      if (!payload.question) return;
      const normalized = normalizeFeedQuestion(payload.question);
      dispatch(updateQuestion({ id: normalized.id, data: normalized }));
    };

    channel.bind(QUESTION_CREATED_EVENT, handleCreated);
    channel.bind(QUESTION_UPDATED_EVENT, handleUpdated);

    return () => {
      channel.unbind(QUESTION_CREATED_EVENT, handleCreated);
      channel.unbind(QUESTION_UPDATED_EVENT, handleUpdated);
      client.unsubscribe(QUESTION_FEED_CHANNEL);
    };
  }, [dispatch, userId, scrollToTop]);

  // When the Feed tab regains focus, refresh if the cache is older than 30s
  // and snap the list to the top. Covers the post-question → switch-tab path:
  // the user lands on the freshest feed with their new question at the top,
  // works the same for students and teachers, and doesn't depend on Pusher.
  useFocusEffect(
    useCallback(() => {
      const lastFetched = store.getState().feed.lastFetchedAt;
      const thirtySecondsAgo = Date.now() - 30_000;
      if (!lastFetched || lastFetched < thirtySecondsAgo) {
        void loadFeed(true);
      }
      scrollToTop(false);
    }, [loadFeed, scrollToTop]),
  );

  // Step 1: stable sorted ID list — only recomputed on fetch/refresh or
  // filter/sort change, NOT on every optimistic reaction update. This stops
  // items from jumping position when the user taps Like / Insightful.
  const stableSortKey = feedState.lastFetchedAt;
  const stableOrderedIds = useMemo(() => {
    const filtered = feedQuestions.filter((q) => {
      if (!matchesQuestionSearch(q, normalizedSearch)) return false;
      switch (activeView) {
        case "waiting":
          return q.status !== "SOLVED";
        case "solved":
          return q.status === "SOLVED";
        case "media":
          return hasMediaQuestion(q);
        case "discussion":
          return q.commentCount > 0;
        default:
          return true;
      }
    });
    const createdAtDiff = (a: FeedQuestion, b: FeedQuestion) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    const scoreHot = (q: FeedQuestion) =>
      q.reactionCount * 2 + q.commentCount * 3 + q.answerCount * 4;
    return filtered
      .sort((a, b) => {
        if (activeSort === "new") return createdAtDiff(a, b);
        if (activeSort === "discussed")
          return (
            b.commentCount - a.commentCount ||
            b.reactionCount - a.reactionCount ||
            createdAtDiff(a, b)
          );
        return scoreHot(b) - scoreHot(a) || createdAtDiff(a, b);
      })
      .map((q) => getFeedQuestionId(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSort, stableSortKey, normalizedSearch, activeView]);

  // Step 2: apply stable order to live question data so reaction counts
  // update in-place without reshuffling positions.
  const visibleQuestions = useMemo(() => {
    const lookup = new Map(feedQuestions.map((q) => [getFeedQuestionId(q), q]));
    return stableOrderedIds.map((id) => lookup.get(id)).filter(Boolean) as FeedQuestion[];
  }, [stableOrderedIds, feedQuestions]);

  const visibleCourses = useMemo(() => {
    const matched = courseList.filter((c) => matchesCourseSearch(c, normalizedSearch));
    return matched.slice(0, 6);
  }, [courseList, normalizedSearch]);
  const shouldHideCoursesForSearch = false;

  const handleRefresh = async () => {
    dispatch(setFeedRefreshing(true));
    dispatch(setCoursesRefreshing(true));
    try {
      await Promise.all([loadFeed(true), loadCourses(true)]);
    } finally {
      dispatch(setFeedRefreshing(false));
      dispatch(setCoursesRefreshing(false));
    }
  };

  const fetchComments = async (questionId: string) => {
    try {
      const res = await api.get(`/questions/${questionId}/comments?limit=6`);
      const comments = Array.isArray(res.data) ? res.data : [];
      setCommentsMap((prev) => ({
        ...prev,
        [questionId]: dedupeComments(comments as PeerCommentItem[]),
      }));
    } catch {
      setCommentsMap((prev) => ({ ...prev, [questionId]: prev[questionId] || [] }));
    }
  };

  const toggleAnswer = (questionId: string) => {
    setExpandedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  const toggleComments = useCallback(
    (questionId: string) => {
      setExpandedComments((prev) => {
        const next = new Set(prev);
        if (next.has(questionId)) {
          next.delete(questionId);
        } else {
          next.add(questionId);
          if (!commentsMap[questionId]) void fetchComments(questionId);
        }
        return next;
      });
    },
    [commentsMap, fetchComments],
  );

  const handleReact = useCallback(
    async (questionId: string, type: ReactionType) => {
      if (!userId) return;
      const targetQuestion = feedQuestions.find(
        (q) => getFeedQuestionId(q) === questionId,
      );
      if (!targetQuestion) return;

      const nextReactions = [...targetQuestion.reactions];
      const idx = nextReactions.findIndex((r) => r.userId === userId);
      if (idx >= 0) {
        if (nextReactions[idx].type === type) nextReactions.splice(idx, 1);
        else nextReactions[idx] = { ...nextReactions[idx], type };
      } else {
        nextReactions.push({ userId, type });
      }

      const optimistic: FeedQuestion = {
        ...targetQuestion,
        reactions: nextReactions,
        reactionCount: nextReactions.length,
      };
      dispatch(updateQuestion({ id: questionId, data: optimistic }));

      try {
        const res = await api.post(`/questions/${questionId}/react`, { type });
        dispatch(
          updateQuestion({ id: questionId, data: normalizeFeedQuestion(res.data) }),
        );
      } catch {
        dispatch(updateQuestion({ id: questionId, data: targetQuestion }));
      }
    },
    [userId, feedQuestions, dispatch],
  );

  const handleAccept = useCallback(
    async (questionId: string) => {
      setAcceptingId(questionId);
      try {
        const res = await api.post(`/questions/${questionId}/accept`);
        const updated = normalizeFeedQuestion(res.data);
        dispatch(updateQuestion({ id: questionId, data: updated }));

        const timerDeadline = res.data?.timerDeadline;
        const channelId = updated.channelId;
        if (timerDeadline && channelId) {
          scheduleAnswerDeadlineReminder({
            questionTitle: updated.title,
            channelId,
            timerDeadline,
          }).catch(() => {});
        }

        if (channelId) router.push(`/workspace/${channelId}` as any);
      } catch (err: any) {
        Toast.show({
          type: "error",
          text1:
            err?.response?.data?.error ??
            err?.response?.data?.message ??
            "Failed to accept question",
        });
      } finally {
        setAcceptingId(null);
      }
    },
    [api, dispatch, router, scheduleAnswerDeadlineReminder],
  );

  const handleDelete = useCallback(
    (questionId: string, questionTitle: string) => {
      Alert.alert(
        "Delete question",
        `Are you sure you want to delete "${questionTitle.length > 60 ? questionTitle.slice(0, 60) + "…" : questionTitle}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              setDeletingId(questionId);
              try {
                await api.delete(`/questions/${questionId}`);
                dispatch(removeQuestion(questionId));
                dispatch(
                  updateUser({
                    questionsAsked: Math.max(0, (user?.questionsAsked ?? 1) - 1),
                  }),
                );
                Toast.show({ type: "success", text1: "Question deleted." });
              } catch (err: any) {
                Toast.show({
                  type: "error",
                  text1: err?.response?.data?.error ?? "Failed to delete question",
                });
              } finally {
                setDeletingId(null);
              }
            },
          },
        ],
      );
    },
    [api, dispatch, removeQuestion, updateUser, user],
  );

  const handleSubmitComment = useCallback(
    async (questionId: string) => {
      const text = commentInput[questionId]?.trim();
      if (!text) return;
      setIsSubmittingComment(questionId);
      try {
        const res = await api.post(`/questions/${questionId}/comments`, {
          content: text,
        });
        if (res.data?.comment) {
          const incoming = res.data.comment as PeerCommentItem;
          setCommentsMap((prev) => ({
            ...prev,
            [questionId]: dedupeComments([incoming, ...(prev[questionId] || [])]),
          }));
          setCommentInput((prev) => ({ ...prev, [questionId]: "" }));
          const current = feedQuestions.find((q) => getFeedQuestionId(q) === questionId);
          dispatch(
            updateQuestion({
              id: questionId,
              data: { commentCount: (current?.commentCount ?? 0) + 1 },
            }),
          );
        }
        Toast.show({
          type: "success",
          text1: res.data?.milestoneMessage ?? "Comment posted!",
        });
      } catch (err: any) {
        Toast.show({
          type: "error",
          text1:
            err?.response?.data?.error ??
            err?.response?.data?.message ??
            "Failed to post comment",
        });
      } finally {
        setIsSubmittingComment(null);
      }
    },
    [commentInput, feedQuestions, dispatch],
  );

  // ─── Filter Modal ───────────────────────────────────────────────
  const renderFilterModal = () => {
    const translateY = modalSlide.interpolate({
      inputRange: [0, 1],
      outputRange: [600, 0],
    });

    return (
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeFilterModal}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "flex-end",
          }}
          onPress={closeFilterModal}
        >
          <RNAnimated.View style={{ transform: [{ translateY }] }}>
            <Pressable onPress={() => {}}>
              <View
                style={{
                  backgroundColor: cardColor,
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  paddingHorizontal: 20,
                  paddingBottom: 36,
                  paddingTop: 20,
                }}
              >
                {/* Handle */}
                <View style={{ alignItems: "center", marginBottom: 20 }}>
                  <View
                    style={{
                      height: 4,
                      width: 40,
                      borderRadius: 99,
                      backgroundColor: borderColor,
                    }}
                  />
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 20,
                  }}
                >
                  <Text
                    style={{ fontSize: 17, fontWeight: "700", color: undefined }}
                    className="text-foreground"
                  >
                    Filters
                  </Text>
                  {hasActiveFilters ? (
                    <TouchableOpacity
                      onPress={() => {
                        setSearchInput("");
                        setActiveView("all");
                        setActiveSort(defaultSort);
                      }}
                    >
                      <Text
                        style={{ fontSize: 14, fontWeight: "500", color: primaryColor }}
                      >
                        Reset all
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* View */}
                <Text className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  View
                </Text>
                <View className="mb-5 flex-row flex-wrap gap-2">
                  {FEED_VIEW_OPTIONS.map((opt) => {
                    const isActive = activeView === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => setActiveView(opt.value)}
                        activeOpacity={0.7}
                        className={cx(
                          "flex-row items-center gap-1.5 rounded-full border px-3 py-2",
                          isActive
                            ? "border-foreground bg-foreground"
                            : "border-border bg-background",
                        )}
                      >
                        <Ionicons
                          name={opt.icon}
                          size={13}
                          color={isActive ? backgroundColor : mutedIconColor}
                        />
                        <Text
                          className={cx(
                            "text-xs font-medium",
                            isActive ? "text-background" : "text-muted-foreground",
                          )}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Sort */}
                <Text className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Sort
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {FEED_SORT_OPTIONS.map((opt) => {
                    const isActive = activeSort === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => setActiveSort(opt.value)}
                        activeOpacity={0.7}
                        className={cx(
                          "flex-row items-center gap-1.5 rounded-full border px-3 py-2",
                          isActive
                            ? "border-primary/40 bg-primary/10"
                            : "border-border bg-background",
                        )}
                      >
                        <Ionicons
                          name={opt.icon}
                          size={13}
                          color={isActive ? primaryColor : mutedIconColor}
                        />
                        <Text
                          className={cx(
                            "text-xs font-medium",
                            isActive ? "text-primary" : "text-muted-foreground",
                          )}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  onPress={closeFilterModal}
                  activeOpacity={0.85}
                  style={{
                    marginTop: 24,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 16,
                    paddingVertical: 14,
                    backgroundColor: primaryColor,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>
                    Apply · {visibleQuestions.length} questions
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </RNAnimated.View>
        </Pressable>
      </Modal>
    );
  };

  // ─── Header ─────────────────────────────────────────────────────
  const renderHeader = useCallback(
    () => (
      <View className="pt-3">
        {/* App bar */}
        <View className="flex-row items-center pb-3">
          <AppLogo />
        </View>

        {feedState.error ? (
          <View className="mb-3">
            <AuthNotice tone="error" message={feedState.error} />
          </View>
        ) : null}

        {/* Search + filter row */}
        <View className="mb-4 flex-row items-center gap-2">
          <View className="flex-1 flex-row items-center rounded-xl border border-border bg-card px-3">
            <Ionicons
              name="search-outline"
              size={16}
              color={mutedIconColor}
              style={{ marginRight: 6 }}
            />
            <TextInput
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="Search questions & courses..."
              placeholderTextColor={mutedIconColor}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              className="flex-1 py-2.5 text-sm text-foreground"
            />
            {searchInput ? (
              <TouchableOpacity onPress={() => setSearchInput("")}>
                <Ionicons name="close-circle" size={16} color={mutedIconColor} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Notes button */}
          <Pressable
            onPress={() => router.push("/notes" as any)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={({ pressed }) => ({
              height: 40,
              width: 40,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              borderWidth: 1,
              borderColor,
              backgroundColor: pressed ? primarySoftColor : cardColor,
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.92 : 1 }],
            })}
          >
            {({ pressed }: { pressed: boolean }) => (
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                {pressed && (
                  <View
                    style={{
                      position: "absolute",
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: `${primaryColor}20`,
                    }}
                  />
                )}
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={pressed ? primaryColor : iconColor}
                />
              </View>
            )}
          </Pressable>

          {/* Separator */}
          <View
            style={{
              width: 1,
              height: 20,
              backgroundColor: borderColor,
              borderRadius: 1,
            }}
          />

          {/* Filter button */}
          <Pressable
            onPress={openFilterModal}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={({ pressed }) => ({
              height: 40,
              width: 40,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              borderWidth: 1,
              borderColor,
              backgroundColor: pressed ? primarySoftColor : cardColor,
              position: "relative",
            })}
          >
            <Ionicons name="options-outline" size={18} color={iconColor} />
            {activeFilterCount > 0 ? (
              <View
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  height: 16,
                  width: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 99,
                  backgroundColor: primaryColor,
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: "700", color: "#fff" }}>
                  {activeFilterCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {!shouldHideCoursesForSearch ? (
          <View className="mb-4">
            {coursesState.isLoading && visibleCourses.length === 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 4 }}
              >
                {[1, 2, 3].map((i) => (
                  <View
                    key={i}
                    className="mr-2.5 w-40 overflow-hidden rounded-2xl border border-border bg-card"
                    style={{ borderColor }}
                  >
                    <View className="bg-muted/20 h-24" />
                    <View className="px-2.5 py-2">
                      <View className="bg-muted/30 h-3 w-24 rounded-full" />
                      <View className="bg-muted/30 mt-2 h-2.5 w-20 rounded-full" />
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : visibleCourses.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 4 }}
              >
                {visibleCourses.map((course, index) => (
                  <TouchableOpacity
                    key={course._id}
                    onPress={() => router.push(`/course/${course._id}` as any)}
                    activeOpacity={0.85}
                    className="mr-2.5 w-40 overflow-hidden rounded-2xl border border-border bg-card"
                    style={{ borderColor }}
                  >
                    {course.thumbnailUrl ? (
                      <Image
                        source={{ uri: course.thumbnailUrl }}
                        className="h-24 w-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={{
                          backgroundColor:
                            COURSE_FALLBACK_COLORS[index % COURSE_FALLBACK_COLORS.length],
                        }}
                        className="h-24 w-full justify-between p-2"
                      >
                        {course.isFeatured ? (
                          <View className="self-start rounded-full bg-black/25 px-2 py-0.5">
                            <Text className="text-[9px] font-semibold uppercase text-white">
                              Featured
                            </Text>
                          </View>
                        ) : (
                          <View />
                        )}
                        <View>
                          <Text
                            className="text-xs font-semibold text-white"
                            numberOfLines={2}
                          >
                            {course.title}
                          </Text>
                          <Text
                            className="mt-0.5 text-[10px] text-white/85"
                            numberOfLines={1}
                          >
                            {course.subject || "Course"}
                          </Text>
                        </View>
                      </View>
                    )}
                    <View className="px-2.5 py-2">
                      <Text
                        className="text-xs font-semibold text-foreground"
                        numberOfLines={2}
                      >
                        {course.title}
                      </Text>
                      <Text
                        className="mt-0.5 text-[10px] text-muted-foreground"
                        numberOfLines={1}
                      >
                        {formatCoursePrice(course)} · {course.subject || "Course"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/courses" as any)}
                  className="bg-muted/10 mr-2.5 h-24 w-16 items-center justify-center rounded-2xl border border-dashed border-border"
                >
                  <Ionicons name="arrow-forward" size={16} color={mutedIconColor} />
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <View
                className="flex-row items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-4 py-3"
                style={{ borderColor }}
              >
                <View
                  className="h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: primarySoftColor }}
                >
                  <Ionicons name="book-outline" size={20} color={primaryColor} />
                </View>
                <Text className="flex-1 text-sm font-semibold text-foreground">
                  No courses yet
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {/* Divider + count */}
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Questions
          </Text>
          <Text className="text-[11px] text-muted-foreground">
            {visibleQuestions.length} posts
          </Text>
        </View>
      </View>
    ),
    [
      feedState.error,
      searchInput,
      activeFilterCount,
      coursesState.isLoading,
      visibleCourses,
      shouldHideCoursesForSearch,
      visibleQuestions.length,
      borderColor,
      cardColor,
      iconColor,
      mutedIconColor,
      primaryColor,
      primarySoftColor,
      openFilterModal,
    ],
  );

  // ─── Question Card ───────────────────────────────────────────────
  const renderQuestionItem = useCallback(
    ({ item }: { item: FeedQuestion }) => {
      const questionId = getFeedQuestionId(item);
      const isOwnQuestion = userId === item.askerId;
      const canAccept =
        isTeacher &&
        !isOwnQuestion &&
        (item.status === "OPEN" || item.status === "RESET");
      const canComment = Boolean(userId) && !isOwnQuestion;
      const isAnswerExpanded = expandedAnswers.has(questionId);
      const isCommentsExpanded = expandedComments.has(questionId);
      const comments = dedupeComments(commentsMap[questionId] || []);
      const userReaction = userId
        ? item.reactions.find((r) => r.userId === userId)
        : undefined;
      const reactionSummary = getReactionSummary(item);
      const hasAnswer = Boolean(item.answer);
      const isSolved = item.status === "SOLVED";
      const isAccepted = item.status === "ACCEPTED";

      const isPrivate = item.answerVisibility === "PRIVATE";
      const isOptimistic = feedState.optimisticIds.includes(questionId);
      const canDelete =
        isOwnQuestion &&
        (item.status === "OPEN" || item.status === "RESET") &&
        !isOptimistic;

      return (
        <View
          className="overflow-hidden bg-card"
          style={{
            backgroundColor: cardColor,
            borderBottomWidth: 1,
            borderBottomColor: borderColor,
            opacity: isOptimistic ? 0.7 : 1,
          }}
        >
          <View className="px-4 py-4">
            {/* ── Author Row ─────────────────────────── */}
            <View className="flex-row items-center gap-3">
              <View className="bg-primary/10 h-10 w-10 overflow-hidden rounded-full border border-border">
                {item.askerImage ? (
                  <Image
                    source={{ uri: item.askerImage }}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <Text className="text-sm font-bold text-primary">
                      {item.askerName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <View className="flex-1">
                <Text
                  className="text-[14px] font-semibold text-foreground"
                  numberOfLines={1}
                >
                  {item.askerName}
                </Text>
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-[12px] text-muted-foreground">
                    {formatTimeAgo(item.createdAt)}
                  </Text>
                  {isPrivate ? (
                    <>
                      <Text className="text-[12px] text-muted-foreground">·</Text>
                      <View className="flex-row items-center gap-0.5">
                        <Ionicons name="lock-closed" size={10} color={mutedIconColor} />
                        <Text className="text-[11px] text-muted-foreground">Private</Text>
                      </View>
                    </>
                  ) : null}
                </View>
              </View>
              {isOptimistic ? (
                <View className="flex-row items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1">
                  <ActivityIndicator size={10} color="#f59e0b" />
                  <Text className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    Posting…
                  </Text>
                </View>
              ) : isSolved ? (
                <View className="flex-row items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1">
                  <Ionicons name="checkmark-circle" size={12} color="#10b981" />
                  <Text className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Solved
                  </Text>
                </View>
              ) : isAccepted ? (
                <View className="flex-row items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1">
                  <Ionicons name="ellipse" size={8} color="#38bdf8" />
                  <Text className="text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                    Active
                  </Text>
                </View>
              ) : null}
            </View>

            {/* ── Question Content ───────────────────── */}
            <Text
              className="mt-3 text-[17px] font-semibold leading-6 text-foreground"
              style={{ letterSpacing: -0.2 }}
            >
              {item.title}
            </Text>

            {item.body ? (
              <Text
                className="mt-1.5 text-[14px] leading-[22px] text-muted-foreground"
                numberOfLines={3}
              >
                {item.body}
              </Text>
            ) : null}

            {(item.images?.length ?? 0) > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-3"
                contentContainerStyle={{ paddingRight: 4 }}
              >
                {item.images?.map((url, i) => (
                  <TouchableOpacity
                    key={i}
                    activeOpacity={0.85}
                    onPress={() => openImageViewer(url)}
                    className="mr-2 overflow-hidden rounded-xl border border-border"
                  >
                    <Image
                      source={{ uri: url }}
                      className="h-24 w-24"
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}

            {/* ── Answer Preview / Expand ────────────── */}
            {isSolved && hasAnswer ? (
              <Animated.View className="mt-3 overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05]">
                <TouchableOpacity
                  onPress={() => toggleAnswer(questionId)}
                  activeOpacity={0.85}
                >
                  <View className="flex-row items-center gap-2 px-3.5 py-3">
                    <Ionicons name="checkmark-circle" size={17} color="#10b981" />
                    <Text
                      className="flex-1 text-[14px] font-medium text-foreground"
                      numberOfLines={1}
                    >
                      {isAnswerExpanded
                        ? "Hide accepted answer"
                        : item.answer?.content
                          ? item.answer.content.length > 80
                            ? item.answer.content.slice(0, 80) + "…"
                            : item.answer.content
                          : "View accepted answer"}
                    </Text>
                    <Ionicons
                      name={isAnswerExpanded ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={mutedIconColor}
                    />
                  </View>

                  {isAnswerExpanded ? (
                    <Animated.View
                      entering={FadeIn.duration(140)}
                      exiting={FadeOut.duration(100)}
                    >
                      <AnswerDetails
                        item={item}
                        primaryColor={primaryColor}
                        mutedIconColor={mutedIconColor}
                        borderColor={borderColor}
                        onImagePress={openImageViewer}
                      />
                    </Animated.View>
                  ) : null}
                </TouchableOpacity>
              </Animated.View>
            ) : isAccepted ? (
              <View className="mt-3 rounded-xl border border-sky-500/20 bg-sky-500/[0.05] px-3 py-2.5">
                <Text className="text-xs text-muted-foreground">
                  {item.acceptedByName
                    ? `${item.acceptedByName} is working on this...`
                    : "Being answered..."}
                </Text>
              </View>
            ) : null}

            {/* ── Bottom Bar: Reactions + Comments ──── */}
            <View
              className="mt-3 flex-row items-center justify-between border-t pt-2.5"
              style={{ borderTopColor: borderColor }}
            >
              {/* Reactions */}
              <View className="flex-row items-center gap-1">
                {REACTION_BUTTONS.map(({ type, icon, activeIcon }) => {
                  const isActive = userReaction?.type === type;
                  const count = reactionSummary[type];
                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => handleReact(questionId, type)}
                      className="flex-row items-center gap-1 rounded-full px-2.5 py-1.5"
                      style={{
                        backgroundColor: isActive ? `${primaryColor}18` : "transparent",
                      }}
                    >
                      <Ionicons
                        name={isActive ? activeIcon : icon}
                        size={16}
                        color={isActive ? primaryColor : mutedIconColor}
                      />
                      {count > 0 ? (
                        <Text
                          className="text-xs font-medium"
                          style={{ color: isActive ? primaryColor : mutedIconColor }}
                        >
                          {count}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Right side: comment count + accept */}
              <View className="flex-row items-center gap-2">
                <TouchableOpacity
                  onPress={() => toggleComments(questionId)}
                  className="flex-row items-center gap-1.5"
                >
                  <Ionicons
                    name={isCommentsExpanded ? "chatbubble" : "chatbubble-outline"}
                    size={15}
                    color={isCommentsExpanded ? primaryColor : mutedIconColor}
                  />
                  <Text
                    className="text-xs"
                    style={{ color: isCommentsExpanded ? primaryColor : mutedIconColor }}
                  >
                    {item.commentCount}
                  </Text>
                </TouchableOpacity>

                {canDelete ? (
                  <TouchableOpacity
                    disabled={deletingId === questionId}
                    onPress={() => handleDelete(questionId, item.title)}
                    className="flex-row items-center gap-1 rounded-full px-2.5 py-1.5"
                    style={{ backgroundColor: "#ef444418" }}
                  >
                    {deletingId === questionId ? (
                      <ActivityIndicator color="#ef4444" size="small" />
                    ) : (
                      <Ionicons name="trash-outline" size={14} color="#ef4444" />
                    )}
                  </TouchableOpacity>
                ) : null}

                {canAccept ? (
                  <TouchableOpacity
                    disabled={acceptingId === questionId}
                    onPress={() => handleAccept(questionId)}
                    className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {acceptingId === questionId ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-outline" size={13} color="#fff" />
                        <Text className="text-xs font-semibold text-white">Accept</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* ── Comments Panel ─────────────────────── */}
            {isCommentsExpanded ? (
              <View className="border-border/60 bg-muted/10 mt-3 rounded-xl border p-3">
                {comments.length === 0 ? (
                  <Text className="text-sm text-muted-foreground">No comments yet.</Text>
                ) : (
                  <View className="gap-3">
                    {comments.map((comment) => (
                      <View key={comment._id} className="flex-row gap-2.5">
                        {comment.studentId?.userImage ? (
                          <Image
                            source={{ uri: comment.studentId.userImage }}
                            className="h-7 w-7 rounded-full border border-border"
                            resizeMode="cover"
                          />
                        ) : (
                          <View className="bg-primary/10 h-7 w-7 items-center justify-center rounded-full">
                            <Text className="text-[11px] font-bold text-primary">
                              {(comment.studentId?.name || "U").charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View className="flex-1">
                          <View className="flex-row items-center gap-1.5">
                            <Text className="text-[13px] font-semibold text-foreground">
                              {comment.studentId?.name || "Anonymous"}
                            </Text>
                            <Text className="text-[11px] text-muted-foreground">
                              {formatTimeAgo(comment.createdAt)}
                            </Text>
                          </View>
                          <Text className="mt-0.5 text-sm leading-5 text-foreground">
                            {comment.content}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {canComment ? (
                  <View className="border-border/60 mt-3 flex-row items-end gap-2 border-t pt-3">
                    <TextInput
                      value={commentInput[questionId] || ""}
                      onChangeText={(text) =>
                        setCommentInput((prev) => ({ ...prev, [questionId]: text }))
                      }
                      placeholder="Write a comment..."
                      placeholderTextColor={mutedIconColor}
                      multiline
                      className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                      style={{ textAlignVertical: "top", minHeight: 38, maxHeight: 100 }}
                    />
                    <TouchableOpacity
                      disabled={
                        isSubmittingComment === questionId ||
                        !commentInput[questionId]?.trim()
                      }
                      onPress={() => handleSubmitComment(questionId)}
                      className="h-9 w-9 items-center justify-center rounded-xl"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {isSubmittingComment === questionId ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Ionicons name="send" size={15} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      );
    },
    [
      userId,
      isTeacher,
      expandedAnswers,
      expandedComments,
      commentsMap,
      commentInput,
      feedState.optimisticIds,
      acceptingId,
      deletingId,
      isSubmittingComment,
      cardColor,
      borderColor,
      primaryColor,
      mutedIconColor,
      handleAccept,
      handleDelete,
      handleReact,
      handleSubmitComment,
      openImageViewer,
      toggleComments,
    ],
  );

  // ─── Empty State ─────────────────────────────────────────────────
  const renderEmptyState = useCallback(() => {
    if (isInitialFeedLoading) {
      return (
        <View className="gap-3">
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              className="rounded-2xl border border-border bg-card p-4"
              style={{ borderColor }}
            >
              <View className="flex-row items-center gap-3">
                <View className="bg-muted/30 h-10 w-10 rounded-full" />
                <View className="gap-1.5">
                  <View className="bg-muted/30 h-3 w-24 rounded-full" />
                  <View className="bg-muted/30 h-2.5 w-14 rounded-full" />
                </View>
              </View>
              <View className="bg-muted/30 mt-3 h-4 w-4/5 rounded-full" />
              <View className="bg-muted/30 mt-2 h-3 w-full rounded-full" />
              <View className="bg-muted/30 mt-2 h-3 w-3/4 rounded-full" />
            </View>
          ))}
        </View>
      );
    }

    const emptyTitle =
      feedQuestions.length === 0
        ? "No questions yet"
        : normalizedSearch.length > 0
          ? "No results found"
          : "Nothing here";

    const emptyBody =
      feedQuestions.length === 0
        ? "New questions will appear here as soon as they're posted."
        : normalizedSearch.length > 0
          ? "Try a different keyword."
          : "Adjust your filters to see more questions.";

    return (
      <View className="items-center rounded-2xl border border-dashed border-border bg-card p-6">
        <View
          className="mb-3 h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: primarySoftColor }}
        >
          <Ionicons
            name={feedQuestions.length === 0 ? "chatbubbles-outline" : "search-outline"}
            size={28}
            color={primaryColor}
          />
        </View>
        <Text className="text-center text-base font-semibold text-foreground">
          {emptyTitle}
        </Text>
        <Text className="mt-1.5 max-w-[260px] text-center text-sm leading-5 text-muted-foreground">
          {emptyBody}
        </Text>
        <View className="mt-4 flex-row gap-2">
          {feedQuestions.length === 0 ? (
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/ask" as any)}
              className="rounded-full px-4 py-2.5"
              style={{ backgroundColor: primaryColor }}
            >
              <Text className="text-sm font-semibold text-white">Post a question</Text>
            </TouchableOpacity>
          ) : null}
          {hasActiveFilters ? (
            <TouchableOpacity
              onPress={() => {
                setSearchInput("");
                setActiveView("all");
                setActiveSort(defaultSort);
              }}
              className="rounded-full border border-border bg-background px-4 py-2.5"
            >
              <Text className="text-sm font-semibold text-foreground">Reset filters</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }, [
    isInitialFeedLoading,
    feedQuestions.length,
    normalizedSearch,
    hasActiveFilters,
    defaultSort,
    borderColor,
    primaryColor,
    primarySoftColor,
  ]);

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {renderFilterModal()}

      <FlatList
        ref={flatListRef}
        data={visibleQuestions}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        keyExtractor={getQuestionKey}
        renderItem={renderQuestionItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={
          feedState.isLoadingMore ? (
            <View className="items-center py-6">
              <ActivityIndicator color={primaryColor} />
            </View>
          ) : null
        }
        onEndReached={() => {
          if (!feedState.isLoadingMore && feedState.hasMore) void loadMore();
        }}
        onEndReachedThreshold={0.4}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews
        contentContainerStyle={{
          paddingHorizontal: 8,
          paddingBottom: 32,
          paddingTop: Platform.OS === "ios" ? 52 : (StatusBar.currentHeight ?? 24) + 8,
        }}
        ItemSeparatorComponent={() => <View className="bg-muted/10 h-3" />}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={primaryColor}
          />
        }
        keyboardDismissMode="none"
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
