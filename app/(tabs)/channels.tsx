import { View, Text, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator } from "react-native";
import { useEffect } from "react";
import { router } from "expo-router";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  setChannels,
  setChannelsLoading,
  setChannelsRefreshing,
} from "@/store/slices/channelsSlice";
import api from "@/lib/api";

export default function ChannelsScreen() {
  const dispatch = useAppDispatch();
  const { list, isLoading, isRefreshing } = useAppSelector((s) => s.channels);

  useEffect(() => {
    loadChannels();
  }, []);

  async function loadChannels() {
    dispatch(setChannelsLoading(true));
    try {
      const res = await api.get("/channels");
      // API returns a plain array
      dispatch(setChannels(Array.isArray(res.data) ? res.data : []));
    } catch {
      dispatch(setChannelsLoading(false));
    }
  }

  async function handleRefresh() {
    dispatch(setChannelsRefreshing(true));
    await loadChannels();
  }

  return (
    <View className="flex-1 bg-slate-950">
      <View className="px-4 pt-14 pb-4">
        <Text className="text-white text-2xl font-bold">Channels</Text>
        <Text className="text-slate-400 text-sm mt-0.5">
          Your active conversations
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#3B82F6" size="large" />
        </View>
      ) : list.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-4">💬</Text>
          <Text className="text-white text-lg font-semibold text-center mb-2">
            No active channels
          </Text>
          <Text className="text-slate-400 text-sm text-center">
            Channels appear here when a teacher accepts your question.
          </Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#3B82F6"
            />
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View className="h-1" />}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() =>
                router.push(`/workspace/${item._id}` as any)
              }
              className="flex-row items-center py-4 px-4 bg-slate-900 rounded-2xl border border-slate-800"
              activeOpacity={0.8}
            >
              {/* Avatar placeholder */}
              <View className="w-12 h-12 rounded-full bg-blue-700 items-center justify-center mr-3">
                <Text className="text-white font-bold text-lg">
                  {(item.questionTitle ?? "Q")[0].toUpperCase()}
                </Text>
              </View>

              <View className="flex-1">
                <View className="flex-row items-center justify-between mb-0.5">
                  <Text
                    className="text-white font-semibold text-sm flex-1 mr-2"
                    numberOfLines={1}
                  >
                    {item.questionTitle ?? "Question"}
                  </Text>
                  {item.lastMessage?.createdAt ? (
                    <Text className="text-slate-500 text-xs">
                      {new Date(item.lastMessage.createdAt).toLocaleDateString()}
                    </Text>
                  ) : null}
                </View>
                <Text className="text-slate-400 text-sm" numberOfLines={1}>
                  {item.lastMessage?.content ?? "No messages yet"}
                </Text>
              </View>

              {item.unreadCount > 0 ? (
                <View className="ml-3 w-5 h-5 rounded-full bg-blue-500 items-center justify-center">
                  <Text className="text-white text-xs font-bold">
                    {item.unreadCount > 9 ? "9+" : item.unreadCount}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
