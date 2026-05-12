import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";
import type { QuizSession } from "@/store/slices/quizSlice";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

export default function QuizResultsScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const {
    statusBarStyle,
    backgroundColor,
    primaryColor,
    primarySoftColor,
    cardColor,
    borderColor,
    mutedIconColor,
  } = useAppTheme();

  const [session, setSession] = useState<QuizSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await api.get(`/quiz/${sessionId}`);
      setSession(res.data.session ?? res.data);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to load results");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void fetchResults();
  }, [fetchResults]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor }}>
        <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
        <ActivityIndicator size="large" color={primaryColor} />
        <Text className="mt-3 text-sm text-muted-foreground">Loading results…</Text>
      </View>
    );
  }

  if (error || !session) {
    return (
      <View
        className="flex-1 items-center justify-center px-8"
        style={{ backgroundColor }}
      >
        <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
        <Ionicons name="alert-circle-outline" size={52} color="#ef4444" />
        <Text className="mt-4 text-center text-base font-semibold text-foreground">
          {error ?? "Session not found"}
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/quiz")}
          className="mt-5 rounded-full px-7 py-3"
          style={{ backgroundColor: primaryColor }}
        >
          <Text className="font-bold text-white">Back to Quizzes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const passed = session.score >= session.passPercent;
  const correctCount = session.questions.filter((q) => q.isCorrect).length;
  const wrongCount = session.questionCount - correctCount;
  const skippedCount = session.questionCount - (session.answeredCount ?? 0);

  const submitLabel =
    session.submitReason === "TIME_EXPIRED"
      ? "Time expired"
      : session.submitReason === "ANTI_CHEAT"
        ? "Auto-submitted (anti-cheat)"
        : "Manually submitted";

  const renderQuestion = ({
    item,
    index,
  }: {
    item: QuizSession["questions"][number];
    index: number;
  }) => {
    const isExpanded = expandedId === item.id;
    const answered = item.selectedOptionIndex !== null;
    const statusColor = item.isCorrect
      ? "#22c55e"
      : answered
        ? "#ef4444"
        : mutedIconColor;
    const statusIcon = item.isCorrect ? "checkmark" : answered ? "close" : "remove";

    return (
      <TouchableOpacity
        className="mb-3 overflow-hidden rounded-2xl border"
        style={{ backgroundColor: cardColor, borderColor }}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        <View className="p-4">
          <View className="flex-row items-start gap-3">
            {/* Status icon */}
            <View
              className="mt-0.5 h-7 w-7 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: statusColor }}
            >
              <Ionicons name={statusIcon} size={14} color="#fff" />
            </View>

            {/* Question text */}
            <Text className="flex-1 text-sm leading-5 text-foreground">
              {index + 1}. {item.questionText}
            </Text>

            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={mutedIconColor}
              style={{ marginTop: 2 }}
            />
          </View>

          {isExpanded ? (
            <View className="mt-4 pl-10">
              {item.options.map((opt, idx) => {
                const isCorrectOption = idx === item.correctOptionIndex;
                const isUserPick = idx === item.selectedOptionIndex;

                let bg = "transparent";
                let bc = borderColor;
                let textColor: string | undefined;
                let labelColor = mutedIconColor;

                if (isCorrectOption) {
                  bg = "rgba(34,197,94,0.1)";
                  bc = "#22c55e";
                  textColor = "#15803d";
                  labelColor = "#22c55e";
                } else if (isUserPick && !item.isCorrect) {
                  bg = "rgba(239,68,68,0.1)";
                  bc = "#ef4444";
                  textColor = "#dc2626";
                  labelColor = "#ef4444";
                }

                return (
                  <View
                    key={idx}
                    className="mb-2 flex-row items-center rounded-xl border px-3 py-2.5"
                    style={{ backgroundColor: bg, borderColor: bc }}
                  >
                    <View
                      className="mr-2.5 h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${labelColor}20` }}
                    >
                      <Text
                        className="text-[11px] font-bold"
                        style={{ color: labelColor }}
                      >
                        {OPTION_LABELS[idx]}
                      </Text>
                    </View>
                    <Text
                      className="flex-1 text-sm leading-5"
                      style={{ color: textColor }}
                    >
                      {opt}
                    </Text>
                    {isUserPick && !isCorrectOption ? (
                      <Ionicons
                        name="close-circle"
                        size={16}
                        color="#ef4444"
                        style={{ marginLeft: 4 }}
                      />
                    ) : null}
                    {isCorrectOption ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#22c55e"
                        style={{ marginLeft: 4 }}
                      />
                    ) : null}
                  </View>
                );
              })}

              {item.explanation ? (
                <View
                  className="mt-2 rounded-xl p-3"
                  style={{
                    backgroundColor: `${primaryColor}10`,
                    borderWidth: 1,
                    borderColor: `${primaryColor}30`,
                  }}
                >
                  <View className="mb-1 flex-row items-center gap-1.5">
                    <Ionicons name="bulb-outline" size={13} color={primaryColor} />
                    <Text className="text-xs font-bold" style={{ color: primaryColor }}>
                      Explanation
                    </Text>
                  </View>
                  <Text className="text-sm leading-5 text-foreground">
                    {item.explanation}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-background" style={{ backgroundColor }}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      <FlatList
        data={session.questions}
        keyExtractor={(item) => item.id}
        renderItem={renderQuestion}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View className="pb-4 pt-14">
            {/* Header row */}
            <View className="mb-5 flex-row items-center">
              <TouchableOpacity
                onPress={() => router.replace("/quiz")}
                className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-secondary"
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-back" size={20} color={primaryColor} />
              </TouchableOpacity>
              <Text className="flex-1 text-xl font-bold text-foreground">
                Quiz Results
              </Text>
              <View
                className="rounded-full px-3 py-1"
                style={{
                  backgroundColor: passed
                    ? "rgba(34,197,94,0.12)"
                    : "rgba(239,68,68,0.12)",
                }}
              >
                <Text
                  className="text-xs font-bold"
                  style={{ color: passed ? "#22c55e" : "#ef4444" }}
                >
                  {passed ? "PASSED" : "FAILED"}
                </Text>
              </View>
            </View>

            {/* Score card */}
            <View
              className="mb-4 overflow-hidden rounded-3xl border"
              style={{ backgroundColor: cardColor, borderColor }}
            >
              {/* Score arc area */}
              <View
                className="items-center py-7"
                style={{
                  backgroundColor: passed
                    ? "rgba(34,197,94,0.06)"
                    : "rgba(239,68,68,0.06)",
                }}
              >
                <View
                  className="mb-3 h-24 w-24 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: passed
                      ? "rgba(34,197,94,0.15)"
                      : "rgba(239,68,68,0.15)",
                    borderWidth: 3,
                    borderColor: passed ? "#22c55e" : "#ef4444",
                  }}
                >
                  <Text
                    className="text-3xl font-bold"
                    style={{ color: passed ? "#22c55e" : "#ef4444" }}
                  >
                    {Math.round(session.score)}%
                  </Text>
                </View>

                <Text className="text-base font-semibold text-muted-foreground">
                  Pass mark: {session.passPercent}%
                </Text>
                <Text className="mt-0.5 text-xs text-muted-foreground">
                  {submitLabel}
                </Text>

                {session.pointsAwarded > 0 ? (
                  <View
                    className="mt-3 flex-row items-center gap-1.5 rounded-full px-4 py-1.5"
                    style={{ backgroundColor: primarySoftColor }}
                  >
                    <Ionicons name="star" size={14} color={primaryColor} />
                    <Text className="text-sm font-bold" style={{ color: primaryColor }}>
                      +{session.pointsAwarded} points earned
                    </Text>
                  </View>
                ) : null}

                {session.violationCount > 0 ? (
                  <View className="mt-2 flex-row items-center gap-1">
                    <Ionicons name="warning-outline" size={13} color="#f59e0b" />
                    <Text className="text-xs text-amber-600">
                      {session.violationCount} violation
                      {session.violationCount > 1 ? "s" : ""} recorded
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Stats row */}
              <View className="flex-row">
                {[
                  { label: "Correct", value: correctCount, color: "#22c55e" },
                  { label: "Wrong", value: wrongCount, color: "#ef4444" },
                  { label: "Skipped", value: skippedCount, color: mutedIconColor },
                  { label: "Total", value: session.questionCount, color: primaryColor },
                ].map((stat, i, arr) => (
                  <View
                    key={stat.label}
                    className="flex-1 items-center py-4"
                    style={{
                      borderRightWidth: i < arr.length - 1 ? 1 : 0,
                      borderRightColor: borderColor,
                      borderTopWidth: 1,
                      borderTopColor: borderColor,
                    }}
                  >
                    <Text className="text-xl font-bold" style={{ color: stat.color }}>
                      {stat.value}
                    </Text>
                    <Text className="text-xs text-muted-foreground">{stat.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Text className="mb-3 text-sm font-semibold text-muted-foreground">
              Question Review
            </Text>
          </View>
        }
        ListFooterComponent={
          <TouchableOpacity
            onPress={() => router.replace("/quiz")}
            className="mt-2 items-center rounded-2xl py-4"
            style={{ backgroundColor: primaryColor }}
            activeOpacity={0.85}
          >
            <Text className="text-base font-bold text-white">Back to Quizzes</Text>
          </TouchableOpacity>
        }
      />
    </View>
  );
}
