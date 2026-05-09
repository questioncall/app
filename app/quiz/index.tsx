import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";
import {
  setTopics,
  setTopicsError,
  setTopicsLoading,
  type QuizTopic,
} from "@/store/slices/quizSlice";

export default function QuizTopicsScreen() {
  const dispatch = useAppDispatch();
  const { topics, topicsLoading, topicsError } = useAppSelector((s) => s.quiz);
  const {
    statusBarStyle,
    backgroundColor,
    primaryColor,
    primarySoftColor,
    cardColor,
    borderColor,
    mutedIconColor,
  } = useAppTheme();

  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchTopics = useCallback(
    async (query = "") => {
      dispatch(setTopicsLoading(true));
      try {
        const res = await api.get("/quiz/topics", {
          params: { q: query || undefined, limit: 60 },
        });
        const list = res.data.topics ?? res.data.suggestions ?? [];
        dispatch(setTopics(list));
      } catch (err: any) {
        dispatch(setTopicsError(err?.response?.data?.error ?? "Failed to load topics"));
      }
    },
    [dispatch],
  );

  useEffect(() => {
    void fetchTopics();
  }, [fetchTopics]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.length >= 2 || search.length === 0) {
        void fetchTopics(search);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search, fetchTopics]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTopics(search);
    setRefreshing(false);
  }, [fetchTopics, search]);

  const startQuiz = (topic: QuizTopic, quizType: "FREE" | "PREMIUM") => {
    router.push({
      pathname: "/quiz/[topicId]" as any,
      params: { topicId: topic.id, quizType },
    });
  };

  const renderTopic = ({ item }: { item: QuizTopic }) => (
    <TouchableOpacity
      className="mx-4 mb-3 overflow-hidden rounded-2xl border"
      style={{ backgroundColor: cardColor, borderColor }}
      onPress={() => startQuiz(item, "FREE")}
      activeOpacity={0.7}
    >
      <View className="p-4">
        <View className="flex-row items-center justify-between">
          <View className="mr-3 flex-1">
            <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
              {item.topic}
            </Text>
            <Text className="mt-0.5 text-xs text-muted-foreground">
              {item.subject} · {item.level}
              {item.field ? ` · ${item.field}` : ""}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Text className="text-xs text-muted-foreground">{item.questionCount} Q</Text>
            <Ionicons name="chevron-forward" size={16} color={mutedIconColor} />
          </View>
        </View>

        <View className="mt-3 flex-row gap-2">
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5"
            style={{ backgroundColor: primarySoftColor }}
            onPress={() => startQuiz(item, "FREE")}
          >
            <Ionicons name="flash-outline" size={14} color={primaryColor} />
            <Text className="text-xs font-semibold" style={{ color: primaryColor }}>
              Free Quiz
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5"
            style={{ backgroundColor: "#f59e0b20" }}
            onPress={() => startQuiz(item, "PREMIUM")}
          >
            <Ionicons name="diamond-outline" size={14} color="#f59e0b" />
            <Text className="text-xs font-semibold text-amber-600">Premium Quiz</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* Header */}
      <View className="flex-row items-center px-4 pb-2 pt-14">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color={primaryColor} />
        </TouchableOpacity>
        <Text className="flex-1 text-2xl font-bold text-foreground">AI Quizzes</Text>
      </View>

      {/* Search */}
      <View className="mx-4 mb-3">
        <View
          className="flex-row items-center rounded-xl border px-3"
          style={{ borderColor }}
        >
          <Ionicons name="search-outline" size={18} color={mutedIconColor} />
          <TextInput
            className="ml-2 flex-1 py-3 text-sm text-foreground"
            value={search}
            onChangeText={setSearch}
            placeholder="Search topics..."
            placeholderTextColor={mutedIconColor}
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={mutedIconColor} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {topicsLoading && topics.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : topicsError && topics.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text className="mt-3 text-center text-base text-foreground">
            {topicsError}
          </Text>
          <TouchableOpacity
            onPress={() => void fetchTopics()}
            className="mt-4 rounded-full px-6 py-2.5"
            style={{ backgroundColor: primaryColor }}
          >
            <Text className="font-semibold text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={topics}
          keyExtractor={(item) => item.id}
          renderItem={renderTopic}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View className="items-center py-20">
              <Ionicons name="help-circle-outline" size={48} color={mutedIconColor} />
              <Text className="mt-3 text-base text-muted-foreground">
                No topics found
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
