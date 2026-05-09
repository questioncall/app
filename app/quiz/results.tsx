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
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text className="mt-3 text-center text-base text-foreground">
          {error ?? "Session not found"}
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/quiz")}
          className="mt-4 rounded-full px-6 py-2.5"
          style={{ backgroundColor: primaryColor }}
        >
          <Text className="font-semibold text-white">Back to Quizzes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const passed = session.score >= session.passPercent;
  const correctCount = session.questions.filter((q) => q.isCorrect).length;

  const submitLabel =
    session.submitReason === "TIME_EXPIRED"
      ? "Time expired"
      : session.submitReason === "ANTI_CHEAT"
        ? "Auto-submitted (violation limit)"
        : "Submitted";

  const renderQuestion = ({
    item,
    index,
  }: {
    item: QuizSession["questions"][number];
    index: number;
  }) => {
    const isExpanded = expandedId === item.id;
    const answered = item.selectedOptionIndex !== null;

    return (
      <TouchableOpacity
        className="mx-4 mb-3 overflow-hidden rounded-2xl border"
        style={{ backgroundColor: cardColor, borderColor }}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        <View className="p-4">
          <View className="flex-row items-start">
            <View
              className="mr-3 mt-0.5 h-6 w-6 items-center justify-center rounded-full"
              style={{
                backgroundColor: item.isCorrect
                  ? "#22c55e"
                  : answered
                    ? "#ef4444"
                    : mutedIconColor,
              }}
            >
              <Ionicons
                name={item.isCorrect ? "checkmark" : answered ? "close" : "remove"}
                size={14}
                color="#fff"
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-foreground">
                {index + 1}. {item.questionText}
              </Text>
            </View>
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={mutedIconColor}
            />
          </View>

          {isExpanded ? (
            <View className="mt-3 pl-9">
              {item.options.map((opt, idx) => {
                const isCorrectOption = idx === item.correctOptionIndex;
                const isUserPick = idx === item.selectedOptionIndex;

                let optBg = "transparent";
                let optBorder = borderColor;
                let optTextColor: string | undefined;

                if (isCorrectOption) {
                  optBg = "rgba(34,197,94,0.1)";
                  optBorder = "#22c55e";
                  optTextColor = "#16a34a";
                } else if (isUserPick && !item.isCorrect) {
                  optBg = "rgba(239,68,68,0.1)";
                  optBorder = "#ef4444";
                  optTextColor = "#dc2626";
                }

                return (
                  <View
                    key={idx}
                    className="mb-2 flex-row items-center rounded-lg border px-3 py-2.5"
                    style={{
                      backgroundColor: optBg,
                      borderColor: optBorder,
                    }}
                  >
                    <Text
                      className="mr-2 text-xs font-semibold"
                      style={{ color: optTextColor ?? mutedIconColor }}
                    >
                      {String.fromCharCode(65 + idx)}
                    </Text>
                    <Text className="flex-1 text-sm" style={{ color: optTextColor }}>
                      {opt}
                    </Text>
                    {isUserPick ? (
                      <Text className="ml-1 text-xs text-muted-foreground">
                        Your answer
                      </Text>
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
                <View className="mt-1 rounded-lg bg-blue-50 p-3 dark:bg-blue-950/30">
                  <Text className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                    Explanation
                  </Text>
                  <Text className="mt-1 text-sm text-blue-800 dark:text-blue-300">
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
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View className="px-4 pb-4 pt-14">
            {/* Header */}
            <View className="mb-4 flex-row items-center">
              <TouchableOpacity onPress={() => router.replace("/quiz")} className="mr-3">
                <Ionicons name="chevron-back" size={24} color={primaryColor} />
              </TouchableOpacity>
              <Text className="flex-1 text-xl font-bold text-foreground">
                Quiz Results
              </Text>
            </View>

            {/* Score card */}
            <View
              className="mb-4 items-center rounded-2xl border p-6"
              style={{ backgroundColor: cardColor, borderColor }}
            >
              <View
                className="mb-3 h-20 w-20 items-center justify-center rounded-full"
                style={{
                  backgroundColor: passed
                    ? "rgba(34,197,94,0.15)"
                    : "rgba(239,68,68,0.15)",
                }}
              >
                <Text
                  className="text-2xl font-bold"
                  style={{ color: passed ? "#22c55e" : "#ef4444" }}
                >
                  {Math.round(session.score)}%
                </Text>
              </View>

              <Text
                className="text-lg font-bold"
                style={{ color: passed ? "#22c55e" : "#ef4444" }}
              >
                {passed ? "Passed!" : "Not Passed"}
              </Text>

              <Text className="mt-1 text-sm text-muted-foreground">
                {correctCount}/{session.questionCount} correct · Pass:{" "}
                {session.passPercent}%
              </Text>

              <Text className="mt-0.5 text-xs text-muted-foreground">{submitLabel}</Text>

              {session.pointsAwarded > 0 ? (
                <View
                  className="mt-3 flex-row items-center gap-1.5 rounded-full px-4 py-1.5"
                  style={{ backgroundColor: primarySoftColor }}
                >
                  <Ionicons name="star" size={14} color={primaryColor} />
                  <Text className="text-sm font-bold" style={{ color: primaryColor }}>
                    +{session.pointsAwarded} points
                  </Text>
                </View>
              ) : null}

              {session.violationCount > 0 ? (
                <Text className="mt-2 text-xs text-amber-600">
                  {session.violationCount} violation
                  {session.violationCount > 1 ? "s" : ""} recorded
                </Text>
              ) : null}
            </View>

            {/* Stats row */}
            <View className="mb-4 flex-row gap-3">
              <View
                className="flex-1 items-center rounded-xl border py-3"
                style={{ borderColor }}
              >
                <Text className="text-lg font-bold text-foreground">
                  {session.answeredCount}
                </Text>
                <Text className="text-xs text-muted-foreground">Answered</Text>
              </View>
              <View
                className="flex-1 items-center rounded-xl border py-3"
                style={{ borderColor }}
              >
                <Text className="text-lg font-bold text-green-600">{correctCount}</Text>
                <Text className="text-xs text-muted-foreground">Correct</Text>
              </View>
              <View
                className="flex-1 items-center rounded-xl border py-3"
                style={{ borderColor }}
              >
                <Text className="text-lg font-bold text-red-500">
                  {session.questionCount - correctCount}
                </Text>
                <Text className="text-xs text-muted-foreground">Wrong</Text>
              </View>
            </View>

            <Text className="mb-2 text-sm font-semibold text-muted-foreground">
              Question Review
            </Text>
          </View>
        }
        ListFooterComponent={
          <View className="mx-4 mt-2">
            <TouchableOpacity
              onPress={() => router.replace("/quiz")}
              className="items-center rounded-xl py-3.5"
              style={{ backgroundColor: primaryColor }}
              activeOpacity={0.8}
            >
              <Text className="text-sm font-bold text-white">Back to Quizzes</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}
