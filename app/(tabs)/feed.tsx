import { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AuthNotice } from "@/components/auth/auth-notice";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";
import {
  setQuestions,
  setFeedLoading,
  setFeedRefreshing,
  setFeedError,
  clearFeedError,
} from "@/store/slices/feedSlice";

export default function FeedScreen() {
  const dispatch = useAppDispatch();
  const userRole = useAppSelector((s) => s.user.data?.role);
  const feedError = useAppSelector((s) => s.feed.error);
  const { questions, myQuestions, isLoading, isRefreshing } = useAppSelector(
    (s) => s.feed,
  );
  const { statusBarStyle, backgroundColor, iconColor } = useAppTheme();
  const isTeacher = userRole === "TEACHER";

  const loadFeed = useCallback(async () => {
    dispatch(setFeedLoading(true));
    dispatch(clearFeedError());

    try {
      const endpoint = isTeacher ? "/questions/feed" : "/questions";
      const res = await api.get(endpoint);
      dispatch(setQuestions(Array.isArray(res.data) ? res.data : []));
    } catch (err: any) {
      dispatch(
        setFeedError(
          err?.response?.data?.error ??
            err?.response?.data?.message ??
            "Unable to load questions right now.",
        ),
      );
    } finally {
      dispatch(setFeedLoading(false));
    }
  }, [dispatch, isTeacher]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const handleRefresh = useCallback(async () => {
    dispatch(setFeedRefreshing(true));
    await loadFeed();
    dispatch(setFeedRefreshing(false));
  }, [dispatch, loadFeed]);

  const data = isTeacher ? questions : myQuestions.length ? myQuestions : questions;

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      <View className="px-6 pt-14 pb-4">
        <Text className="text-[28px] font-bold tracking-tight text-foreground">
          {isTeacher ? "Question Feed" : "My Questions"}
        </Text>
        <Text className="mt-1 text-sm leading-6 text-muted-foreground">
          {isTeacher
            ? "Pick a question to answer."
            : "Track the questions you have posted."}
        </Text>
        {feedError ? <AuthNotice tone="error" message={feedError} /> : null}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={iconColor} size="large" />
        </View>
      ) : data.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl border border-border bg-card">
            <Ionicons
              name={isTeacher ? "chatbox-ellipses-outline" : "school-outline"}
              size={32}
              color={iconColor}
            />
          </View>
          <Text className="text-[18px] font-semibold text-foreground">
            {isTeacher ? "No questions yet" : "No questions posted yet"}
          </Text>
          <Text className="mt-2 max-w-xs text-center text-sm leading-6 text-muted-foreground">
            {isTeacher
              ? "New questions will appear here in real time."
              : "Tap the plus button to post your first question."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={iconColor}
            />
          }
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => (
            <TouchableOpacity
              className="rounded-2xl border border-border bg-card p-4"
              activeOpacity={0.85}
            >
              <View className="mb-2 flex-row items-center justify-between">
                <View
                  className={`rounded-full px-2.5 py-1 ${
                    item.status === "OPEN"
                      ? "bg-emerald-500/10"
                      : item.status === "ACCEPTED"
                        ? "bg-amber-500/10"
                        : "bg-sky-500/10"
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      item.status === "OPEN"
                        ? "text-emerald-600 dark:text-emerald-300"
                        : item.status === "ACCEPTED"
                          ? "text-amber-600 dark:text-amber-300"
                          : "text-sky-600 dark:text-sky-300"
                    }`}
                  >
                    {item.status}
                    {item.resetCount > 0 ? ` · Attempt ${item.resetCount + 1}` : ""}
                  </Text>
                </View>
                <View className="rounded-full border border-border bg-background px-2.5 py-1">
                  <Text className="text-xs text-muted-foreground">
                    {item.answerFormat}
                  </Text>
                </View>
              </View>

              <Text className="mb-1 text-base font-semibold leading-snug text-card-foreground">
                {item.title}
              </Text>
              {item.body ? (
                <Text className="text-sm leading-6 text-muted-foreground" numberOfLines={2}>
                  {item.body}
                </Text>
              ) : null}

              <View className="mt-3 flex-row items-center gap-3 border-t border-border pt-3">
                {item.subject ? (
                  <Text className="text-xs text-muted-foreground">{item.subject}</Text>
                ) : null}
                <Text className="ml-auto text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
