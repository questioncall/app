import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  BackHandler,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";
import { openWebCheckout } from "@/lib/web-checkout";
import {
  clearSession,
  incrementViolation,
  selectAnswer,
  setSession,
  setSessionError,
  setSessionLoading,
  type QuizQuestion,
  type QuizSession,
} from "@/store/slices/quizSlice";

const GRACE_PERIOD_MS = 2000;
const MOUNT_IGNORE_MS = 500;

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

export default function QuizSessionScreen() {
  const { topicId, quizType } = useLocalSearchParams<{
    topicId: string;
    quizType: "FREE" | "PREMIUM";
  }>();

  const dispatch = useAppDispatch();
  const { session, sessionLoading, sessionError } = useAppSelector((s) => s.quiz);
  const {
    statusBarStyle,
    backgroundColor,
    primaryColor,
    primarySoftColor,
    cardColor,
    borderColor,
    mutedIconColor,
    isDark,
  } = useAppTheme();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [warningText, setWarningText] = useState<string | null>(null);

  const mountedAtRef = useRef(Date.now());
  const lastBackgroundRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const submittedRef = useRef(false);
  const dotsScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    sessionIdRef.current = session?.id ?? null;
  }, [session?.id]);

  // ── Start quiz ──
  useEffect(() => {
    if (!topicId) return;
    let cancelled = false;
    dispatch(setSessionLoading(true));
    (async () => {
      try {
        const res = await api.post("/quiz/start", {
          quizType: quizType ?? "FREE",
          topicId,
        });
        if (cancelled) return;
        const s: QuizSession = res.data.session ?? res.data;
        dispatch(setSession(s));
      } catch (err: any) {
        if (cancelled) return;
        // Premium quiz without an active plan → route to the compliant web
        // membership page instead of surfacing a dead-end error.
        if ((quizType ?? "FREE") === "PREMIUM" && err?.response?.status === 403) {
          dispatch(
            setSessionError(
              "Premium quizzes are available with QuestionCall membership.",
            ),
          );
          void openWebCheckout("subscription");
          return;
        }
        dispatch(
          setSessionError(
            err?.response?.data?.error ??
              err?.response?.data?.message ??
              "Failed to start quiz",
          ),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [topicId, quizType, dispatch]);

  // ── Countdown timer ──
  useEffect(() => {
    if (!session?.timerDeadline) return;
    const deadline = new Date(session.timerDeadline).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0 && !submittedRef.current) void handleAutoSubmit("TIME_EXPIRED");
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.timerDeadline]);

  // ── Anti-cheat: AppState ──
  useEffect(() => {
    if (!session || session.status === "SUBMITTED") return;
    const handleChange = (nextState: AppStateStatus) => {
      if (Date.now() - mountedAtRef.current < MOUNT_IGNORE_MS) return;
      if (nextState === "background" || nextState === "inactive") {
        lastBackgroundRef.current = Date.now();
      } else if (nextState === "active" && lastBackgroundRef.current) {
        const away = Date.now() - lastBackgroundRef.current;
        lastBackgroundRef.current = null;
        if (away >= GRACE_PERIOD_MS)
          reportViolation("TAB_HIDDEN", `Away for ${Math.round(away / 1000)}s`);
      }
    };
    const sub = AppState.addEventListener("change", handleChange);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.status]);

  // ── Anti-cheat: Hardware back ──
  useEffect(() => {
    if (!session || session.status === "SUBMITTED") return;
    const handler = () => {
      reportViolation("BACK_NAVIGATION", "Hardware back pressed during quiz");
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", handler);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.status]);

  // ── Warning flash ──
  useEffect(() => {
    if (!warningText) return;
    const t = setTimeout(() => setWarningText(null), 3000);
    return () => clearTimeout(t);
  }, [warningText]);

  // ── Cleanup ──
  useEffect(
    () => () => {
      dispatch(clearSession());
    },
    [dispatch],
  );

  // ── Scroll dots into view when question changes ──
  useEffect(() => {
    dotsScrollRef.current?.scrollTo({
      x: Math.max(0, currentIndex - 3) * 36,
      animated: true,
    });
  }, [currentIndex]);

  const reportViolation = useCallback(
    async (type: string, details?: string) => {
      dispatch(incrementViolation());
      setWarningText(
        `Warning: Leaving the quiz is not allowed. (${(session?.violationCount ?? 0) + 1}/${session?.warningLimit ?? 3})`,
      );
      const sid = sessionIdRef.current;
      if (!sid) return;
      try {
        const res = await api.patch(`/quiz/${sid}/progress`, {
          violation: { type, details },
        });
        if (res.data.submitted || res.data.autoSubmitReason === "ANTI_CHEAT") {
          submittedRef.current = true;
          dispatch(setSession(res.data.session));
        }
      } catch {}
    },
    [dispatch, session?.violationCount, session?.warningLimit],
  );

  const handleSelectOption = useCallback(
    async (question: QuizQuestion, optionIndex: number) => {
      if (!session || session.status === "SUBMITTED") return;
      dispatch(selectAnswer({ questionId: question.id, optionIndex }));
      try {
        await api.patch(`/quiz/${session.id}/progress`, {
          answers: [{ questionId: question.id, selectedOptionIndex: optionIndex }],
        });
      } catch {}
    },
    [dispatch, session],
  );

  const handleAutoSubmit = useCallback(
    async (reason: "TIME_EXPIRED" | "ANTI_CHEAT") => {
      if (submittedRef.current || !sessionIdRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      try {
        const answers = (session?.questions ?? []).map((q) => ({
          questionId: q.id,
          selectedOptionIndex: q.selectedOptionIndex,
        }));
        const res = await api.post(`/quiz/${sessionIdRef.current}/auto-submit`, {
          reason,
          answers,
        });
        dispatch(setSession(res.data.session));
      } catch {
        submittedRef.current = false;
      } finally {
        setSubmitting(false);
      }
    },
    [dispatch, session?.questions],
  );

  const handleSubmit = useCallback(() => {
    const unanswered = (session?.questions ?? []).filter(
      (q) => q.selectedOptionIndex === null,
    ).length;
    const doSubmit = async () => {
      if (submittedRef.current || !session) return;
      submittedRef.current = true;
      setSubmitting(true);
      try {
        const answers = session.questions.map((q) => ({
          questionId: q.id,
          selectedOptionIndex: q.selectedOptionIndex,
        }));
        const res = await api.post(`/quiz/${session.id}/submit`, { answers });
        dispatch(setSession(res.data.session));
      } catch {
        submittedRef.current = false;
      } finally {
        setSubmitting(false);
      }
    };

    if (unanswered > 0) {
      Alert.alert(
        "Submit Quiz?",
        `${unanswered} question${unanswered > 1 ? "s" : ""} unanswered. Submit anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Submit", style: "destructive", onPress: doSubmit },
        ],
      );
    } else {
      Alert.alert("Submit Quiz?", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        { text: "Submit", onPress: doSubmit },
      ]);
    }
  }, [dispatch, session]);

  // ── Navigate to results when submitted ──
  useEffect(() => {
    if (session?.status === "SUBMITTED" && !submitting) {
      router.replace({
        pathname: "/quiz/results" as any,
        params: { sessionId: session.id },
      });
    }
  }, [session?.status, session?.id, submitting]);

  // ─── Loading ───────────────────────────────────────────────────
  if (sessionLoading || (!session && !sessionError)) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor }}>
        <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
        <ActivityIndicator size="large" color={primaryColor} />
        <Text className="mt-3 text-sm text-muted-foreground">Preparing your quiz…</Text>
      </View>
    );
  }

  if (sessionError) {
    return (
      <View
        className="flex-1 items-center justify-center px-8"
        style={{ backgroundColor }}
      >
        <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
        <Ionicons name="alert-circle-outline" size={52} color="#ef4444" />
        <Text className="mt-4 text-center text-base font-semibold text-foreground">
          {sessionError}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-5 rounded-full px-7 py-3"
          style={{ backgroundColor: primaryColor }}
        >
          <Text className="font-bold text-white">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!session) return null;

  const currentQuestion = session.questions[currentIndex];
  const answeredCount = session.questions.filter(
    (q) => q.selectedOptionIndex !== null,
  ).length;
  const totalCount = session.questionCount ?? session.questions.length;
  const isUrgent = timeLeft !== null && timeLeft <= 60;
  const progressPct = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0;

  return (
    <View className="flex-1" style={{ backgroundColor }}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* ── Violation warning banner ── */}
      {warningText ? (
        <View
          className="absolute left-0 right-0 top-0 z-50 items-center px-4 pb-3 pt-14"
          style={{ backgroundColor: "#dc2626" }}
        >
          <View className="flex-row items-center gap-2">
            <Ionicons name="warning" size={16} color="#fff" />
            <Text className="text-sm font-semibold text-white">{warningText}</Text>
          </View>
        </View>
      ) : null}

      {/* ── Header ── */}
      <View
        className="px-4 pb-3 pt-14"
        style={{ backgroundColor, borderBottomWidth: 1, borderBottomColor: borderColor }}
      >
        <View className="flex-row items-center justify-between">
          {/* Topic info */}
          <View className="mr-3 flex-1">
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {session.subject}
            </Text>
            <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
              {session.topic}
            </Text>
          </View>

          {/* Timer */}
          <View
            className="flex-row items-center gap-1.5 rounded-full px-4 py-2"
            style={{
              backgroundColor: isUrgent ? "rgba(239,68,68,0.12)" : primarySoftColor,
            }}
          >
            <Ionicons
              name="timer-outline"
              size={15}
              color={isUrgent ? "#ef4444" : primaryColor}
            />
            <Text
              className="text-base font-bold tabular-nums"
              style={{ color: isUrgent ? "#ef4444" : primaryColor }}
            >
              {timeLeft !== null ? formatTime(timeLeft) : "--:--"}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <View
            className="h-full rounded-full"
            style={{ backgroundColor: primaryColor, width: `${progressPct}%` }}
          />
        </View>
        <View className="mt-1 flex-row justify-between">
          <Text className="text-xs text-muted-foreground">
            {answeredCount}/{totalCount} answered
          </Text>
          <Text className="text-xs text-muted-foreground">
            Q {currentIndex + 1} of {totalCount}
          </Text>
        </View>
      </View>

      {/* ── Question + Options (scrollable) ── */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Question number badge + text */}
        <View
          className="mb-4 rounded-2xl border p-4"
          style={{ backgroundColor: cardColor, borderColor }}
        >
          <View
            className="mb-2 self-start rounded-full px-3 py-0.5"
            style={{ backgroundColor: primarySoftColor }}
          >
            <Text className="text-xs font-bold" style={{ color: primaryColor }}>
              Question {currentIndex + 1}
            </Text>
          </View>
          <Text className="text-[16px] leading-7 text-foreground">
            {currentQuestion?.questionText}
          </Text>
        </View>

        {/* Options */}
        {currentQuestion?.options.map((option, idx) => {
          const isSelected = currentQuestion.selectedOptionIndex === idx;
          return (
            <TouchableOpacity
              key={idx}
              onPress={() => handleSelectOption(currentQuestion, idx)}
              activeOpacity={0.7}
              style={{
                flexDirection: "row",
                alignItems: "center",
                minHeight: 56,
                marginBottom: 10,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 16,
                backgroundColor: isSelected ? primarySoftColor : cardColor,
                borderWidth: isSelected ? 2 : 1,
                borderColor: isSelected ? primaryColor : borderColor,
              }}
            >
              {/* Letter badge */}
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  marginRight: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isSelected ? primaryColor : `${primaryColor}15`,
                }}
              >
                {isSelected ? (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                ) : (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: primaryColor,
                    }}
                  >
                    {OPTION_LABELS[idx]}
                  </Text>
                )}
              </View>
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  lineHeight: 22,
                  color: isSelected ? primaryColor : isDark ? "#e5e5e5" : "#111827",
                  fontWeight: isSelected ? "600" : "400",
                }}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Bottom bar: question dots + nav + submit ── */}
      <View
        style={{
          backgroundColor,
          borderTopWidth: 1,
          borderTopColor: borderColor,
          paddingTop: 10,
          paddingBottom: 28,
          paddingHorizontal: 16,
        }}
      >
        {/* Scrollable question dots */}
        <ScrollView
          ref={dotsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingVertical: 4, paddingHorizontal: 2 }}
          style={{ marginBottom: 12 }}
        >
          {session.questions.map((q, i) => {
            const isActive = i === currentIndex;
            const isAnswered = q.selectedOptionIndex !== null;
            return (
              <TouchableOpacity
                key={q.id}
                onPress={() => setCurrentIndex(i)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isActive
                    ? primaryColor
                    : isAnswered
                      ? primarySoftColor
                      : "transparent",
                  borderWidth: isActive ? 0 : 1,
                  borderColor: isAnswered ? primaryColor : borderColor,
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: isActive ? "#fff" : isAnswered ? primaryColor : mutedIconColor,
                  }}
                >
                  {i + 1}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Prev / Submit / Next row */}
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: currentIndex === 0 ? `${borderColor}55` : primarySoftColor,
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={currentIndex === 0 ? mutedIconColor : primaryColor}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={{
              flex: 1,
              height: 46,
              borderRadius: 23,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: primaryColor,
            }}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                Submit Quiz
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setCurrentIndex((i) => Math.min(totalCount - 1, i + 1))}
            disabled={currentIndex === totalCount - 1}
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                currentIndex === totalCount - 1 ? `${borderColor}55` : primarySoftColor,
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={currentIndex === totalCount - 1 ? mutedIconColor : primaryColor}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
