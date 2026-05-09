import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  BackHandler,
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
  } = useAppTheme();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [warningText, setWarningText] = useState<string | null>(null);

  const mountedAtRef = useRef(Date.now());
  const lastBackgroundRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    sessionIdRef.current = session?.id ?? null;
  }, [session?.id]);

  // ── Start quiz ──
  useEffect(() => {
    if (!topicId) return;
    let cancelled = false;

    (async () => {
      dispatch(setSessionLoading(true));
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
        const msg =
          err?.response?.data?.error ??
          err?.response?.data?.message ??
          "Failed to start quiz";
        dispatch(setSessionError(msg));
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
      if (remaining <= 0 && !submittedRef.current) {
        void handleAutoSubmit("TIME_EXPIRED");
      }
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
        if (away >= GRACE_PERIOD_MS) {
          reportViolation("TAB_HIDDEN", `Away for ${Math.round(away / 1000)}s`);
        }
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

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      dispatch(clearSession());
    };
  }, [dispatch]);

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
        `You have ${unanswered} unanswered question${unanswered > 1 ? "s" : ""}. Submit anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Submit", style: "destructive", onPress: doSubmit },
        ],
      );
    } else {
      Alert.alert("Submit Quiz?", "Are you sure you want to submit?", [
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

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const currentQuestion = session?.questions && session.questions[currentIndex];
  const answeredCount =
    session?.questions?.filter((q) => q.selectedOptionIndex !== null).length ?? 0;
  const totalCount = session?.questionCount ?? 0;

  if (sessionLoading || (!session && !sessionError)) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor }}>
        <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
        <ActivityIndicator size="large" color={primaryColor} />
        <Text className="mt-3 text-sm text-muted-foreground">Preparing your quiz...</Text>
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
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text className="mt-3 text-center text-base text-foreground">{sessionError}</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 rounded-full px-6 py-2.5"
          style={{ backgroundColor: primaryColor }}
        >
          <Text className="font-semibold text-white">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!session || !currentQuestion) return null;

  const isUrgent = timeLeft !== null && timeLeft <= 60;

  return (
    <View className="flex-1 bg-background" style={{ backgroundColor }}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {warningText ? (
        <View className="absolute left-0 right-0 top-0 z-50 bg-red-600 px-4 pb-2 pt-14">
          <Text className="text-center text-sm font-semibold text-white">
            {warningText}
          </Text>
        </View>
      ) : null}

      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pb-2 pt-14">
        <View className="flex-1">
          <Text className="text-sm font-medium text-muted-foreground" numberOfLines={1}>
            {session.subject} · {session.topic}
          </Text>
        </View>
        <View
          className="ml-3 flex-row items-center gap-1.5 rounded-full px-3 py-1"
          style={{
            backgroundColor: isUrgent ? "#fef2f2" : primarySoftColor,
          }}
        >
          <Ionicons
            name="timer-outline"
            size={14}
            color={isUrgent ? "#ef4444" : primaryColor}
          />
          <Text
            className="text-sm font-bold"
            style={{ color: isUrgent ? "#ef4444" : primaryColor }}
          >
            {timeLeft !== null ? formatTime(timeLeft) : "--:--"}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View className="mx-4 mb-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <View
          className="h-full rounded-full"
          style={{
            backgroundColor: primaryColor,
            width: `${totalCount > 0 ? (answeredCount / totalCount) * 100 : 0}%`,
          }}
        />
      </View>

      <Text className="mx-4 mb-3 text-xs text-muted-foreground">
        {answeredCount}/{totalCount} answered
      </Text>

      {/* Question */}
      <View className="mx-4 flex-1">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-muted-foreground">
            Question {currentIndex + 1} of {totalCount}
          </Text>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="rounded-full p-1.5"
              style={{
                backgroundColor: currentIndex === 0 ? "transparent" : primarySoftColor,
              }}
            >
              <Ionicons
                name="chevron-back"
                size={18}
                color={currentIndex === 0 ? mutedIconColor : primaryColor}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCurrentIndex((i) => Math.min(totalCount - 1, i + 1))}
              disabled={currentIndex === totalCount - 1}
              className="rounded-full p-1.5"
              style={{
                backgroundColor:
                  currentIndex === totalCount - 1 ? "transparent" : primarySoftColor,
              }}
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={currentIndex === totalCount - 1 ? mutedIconColor : primaryColor}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View
          className="mb-4 rounded-2xl border p-4"
          style={{ backgroundColor: cardColor, borderColor }}
        >
          <Text className="text-base leading-6 text-foreground">
            {currentQuestion.questionText}
          </Text>
        </View>

        {currentQuestion.options.map((option, idx) => {
          const isSelected = currentQuestion.selectedOptionIndex === idx;
          return (
            <TouchableOpacity
              key={idx}
              className="mb-2.5 flex-row items-center rounded-xl border px-4 py-3.5"
              style={{
                backgroundColor: isSelected ? primarySoftColor : cardColor,
                borderColor: isSelected ? primaryColor : borderColor,
                borderWidth: isSelected ? 1.5 : 1,
              }}
              onPress={() => handleSelectOption(currentQuestion, idx)}
              activeOpacity={0.7}
            >
              <View
                className="mr-3 h-6 w-6 items-center justify-center rounded-full"
                style={{
                  backgroundColor: isSelected ? primaryColor : "transparent",
                  borderWidth: isSelected ? 0 : 1.5,
                  borderColor: isSelected ? primaryColor : mutedIconColor,
                }}
              >
                {isSelected ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : (
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: mutedIconColor }}
                  >
                    {String.fromCharCode(65 + idx)}
                  </Text>
                )}
              </View>
              <Text
                className="flex-1 text-sm"
                style={{ color: isSelected ? primaryColor : undefined }}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Question dots + submit */}
      <View className="border-t px-4 pb-8 pt-3" style={{ borderColor }}>
        <View className="mb-3 flex-row flex-wrap justify-center gap-1.5">
          {session.questions.map((q, i) => (
            <TouchableOpacity
              key={q.id}
              onPress={() => setCurrentIndex(i)}
              className="h-7 w-7 items-center justify-center rounded-full"
              style={{
                backgroundColor:
                  i === currentIndex
                    ? primaryColor
                    : q.selectedOptionIndex !== null
                      ? primarySoftColor
                      : "transparent",
                borderWidth: i === currentIndex ? 0 : 1,
                borderColor: q.selectedOptionIndex !== null ? primaryColor : borderColor,
              }}
            >
              <Text
                className="text-xs font-semibold"
                style={{
                  color:
                    i === currentIndex
                      ? "#fff"
                      : q.selectedOptionIndex !== null
                        ? primaryColor
                        : mutedIconColor,
                }}
              >
                {i + 1}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          className="items-center rounded-xl py-3.5"
          style={{ backgroundColor: primaryColor }}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-sm font-bold text-white">Submit Quiz</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
