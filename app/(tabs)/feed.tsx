import { View, Text, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator } from "react-native";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { setQuestions, setFeedLoading, setFeedRefreshing } from "@/store/slices/feedSlice";
import api from "@/lib/api";

export default function FeedScreen() {
  const dispatch = useAppDispatch();
  const userRole = useAppSelector((s) => s.user.data?.role);
  const { questions, myQuestions, isLoading, isRefreshing } = useAppSelector(
    (s) => s.feed
  );
  const isTeacher = userRole === "TEACHER";

  useEffect(() => {
    loadFeed();
  }, []);

  async function loadFeed() {
    dispatch(setFeedLoading(true));
    try {
      if (isTeacher) {
        const res = await api.get("/questions/feed");
        // API returns a plain array
        dispatch(setQuestions(Array.isArray(res.data) ? res.data : []));
      } else {
        const res = await api.get("/questions");
        dispatch(setQuestions(Array.isArray(res.data) ? res.data : []));
      }
    } catch {
      dispatch(setFeedLoading(false));
    }
  }

  async function handleRefresh() {
    dispatch(setFeedRefreshing(true));
    await loadFeed();
    dispatch(setFeedRefreshing(false));
  }

  const data = isTeacher ? questions : myQuestions.length ? myQuestions : questions;

  return (
    <View className="flex-1 bg-slate-950">
      {/* Header */}
      <View className="px-4 pt-14 pb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-white text-2xl font-bold">
            {isTeacher ? "Question Feed" : "My Questions"}
          </Text>
          <Text className="text-slate-400 text-sm mt-0.5">
            {isTeacher
              ? "Pick a question to answer"
              : "Track your posted questions"}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#3B82F6" size="large" />
        </View>
      ) : data.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-4">
            {isTeacher ? "📭" : "🎓"}
          </Text>
          <Text className="text-white text-lg font-semibold text-center mb-2">
            {isTeacher ? "No questions yet" : "No questions posted"}
          </Text>
          <Text className="text-slate-400 text-sm text-center">
            {isTeacher
              ? "New questions will appear here in real time."
              : "Tap the + button to post your first question."}
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
              tintColor="#3B82F6"
            />
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => (
            <TouchableOpacity
              className="bg-slate-900 rounded-2xl p-4 border border-slate-800"
              activeOpacity={0.8}
            >
              <View className="flex-row items-center justify-between mb-2">
                <View
                  className={`px-2.5 py-1 rounded-full ${
                    item.status === "OPEN"
                      ? "bg-green-900"
                      : item.status === "ACCEPTED"
                      ? "bg-yellow-900"
                      : "bg-blue-900"
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      item.status === "OPEN"
                        ? "text-green-300"
                        : item.status === "ACCEPTED"
                        ? "text-yellow-300"
                        : "text-blue-300"
                    }`}
                  >
                    {item.status}
                    {item.resetCount > 0 ? ` · Attempt ${item.resetCount + 1}` : ""}
                  </Text>
                </View>
                <View className="px-2.5 py-1 rounded-full bg-slate-800">
                  <Text className="text-slate-400 text-xs">{item.answerFormat}</Text>
                </View>
              </View>

              <Text className="text-white text-base font-semibold leading-snug mb-1">
                {item.title}
              </Text>
              {item.body ? (
                <Text className="text-slate-400 text-sm" numberOfLines={2}>
                  {item.body}
                </Text>
              ) : null}

              <View className="flex-row items-center gap-3 mt-3 pt-3 border-t border-slate-800">
                {item.subject ? (
                  <Text className="text-slate-500 text-xs">{item.subject}</Text>
                ) : null}
                <Text className="text-slate-600 text-xs ml-auto">
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
