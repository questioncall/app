import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect } from "react";
import { router } from "expo-router";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  setChannels,
  setChannelsLoading,
  setChannelsRefreshing,
  selectIsChannelsStale,
} from "@/store/slices/channelsSlice";
import type { ChannelListItem } from "@/store/slices/channelsSlice";
import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";

function getChannelKey(item: ChannelListItem, index: number) {
  return `${item._id || item.questionId || item.createdAt || "channel"}-${index}`;
}

export default function ChannelsScreen() {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((s) => s.user.data?._id ?? null);
  const { list, isLoading, isRefreshing, lastFetchedAt, loadedForUserId } =
    useAppSelector((s) => s.channels);
  const { statusBarStyle, backgroundColor, iconColor, primaryColor } = useAppTheme();
  const cacheMatchesUser = loadedForUserId === userId;
  const channels = cacheMatchesUser ? list : [];
  const shouldUseCache = cacheMatchesUser && !selectIsChannelsStale(lastFetchedAt);

  const loadChannels = useCallback(
    async (force = false) => {
      if (!force && (isLoading || shouldUseCache)) {
        return;
      }

      dispatch(setChannelsLoading(true));
      try {
        const res = await api.get("/channels");
        // API returns a plain array
        dispatch(
          setChannels({
            channels: Array.isArray(res.data) ? res.data : [],
            userId,
          }),
        );
      } catch {
        dispatch(setChannelsLoading(false));
        dispatch(setChannelsRefreshing(false));
      }
    },
    [dispatch, isLoading, shouldUseCache, userId],
  );

  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

  const handleRefresh = useCallback(async () => {
    dispatch(setChannelsRefreshing(true));
    await loadChannels(true);
  }, [dispatch, loadChannels]);

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      <View className="px-6 pb-4 pt-14">
        <Text className="text-[28px] font-bold tracking-tight text-foreground">
          Channels
        </Text>
        <Text className="mt-1 text-sm leading-6 text-muted-foreground">
          Your active conversations
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={iconColor} size="large" />
        </View>
      ) : channels.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl border border-border bg-card">
            <Ionicons name="chatbubbles-outline" size={32} color={iconColor} />
          </View>
          <Text className="mb-2 text-center text-[18px] font-semibold text-foreground">
            No active channels
          </Text>
          <Text className="max-w-xs text-center text-sm leading-6 text-muted-foreground">
            Channels appear here when a teacher accepts your question.
          </Text>
        </View>
      ) : (
        <FlatList
          data={channels}
          keyExtractor={getChannelKey}
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
              onPress={() => router.push(`/workspace/${item._id}` as any)}
              className="flex-row items-center rounded-2xl border border-border bg-card px-4 py-4"
              activeOpacity={0.8}
            >
              <View
                className="mr-3 h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: primaryColor }}
              >
                <Text className="text-lg font-bold text-white">
                  {(item.questionTitle ?? "Q")[0].toUpperCase()}
                </Text>
              </View>

              <View className="flex-1">
                <View className="mb-0.5 flex-row items-center justify-between">
                  <Text
                    className="mr-2 flex-1 text-sm font-semibold text-card-foreground"
                    numberOfLines={1}
                  >
                    {item.questionTitle ?? "Question"}
                  </Text>
                  {item.lastMessage?.createdAt ? (
                    <Text className="text-xs text-muted-foreground">
                      {new Date(item.lastMessage.createdAt).toLocaleDateString()}
                    </Text>
                  ) : null}
                </View>
                <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                  {item.lastMessage?.content ?? "No messages yet"}
                </Text>
              </View>

              {item.unreadCount > 0 ? (
                <View
                  className="ml-3 h-5 w-5 items-center justify-center rounded-full"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Text className="text-xs font-bold text-white">
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
