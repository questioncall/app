import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";

type TopTeacher = {
  id: string;
  name: string;
  username: string;
  userImage?: string;
  overallScore: number;
  totalAnswered: number;
  teacherModeVerified: boolean;
};

const MEDAL_COLORS = ["#F59E0B", "#94A3B8", "#CD7C2F"];
const MEDAL_ICONS = ["🥇", "🥈", "🥉"];

export default function LeaderboardScreen() {
  const {
    statusBarStyle,
    backgroundColor,
    cardColor,
    borderColor,
    primaryColor,
    primarySoftColor,
    mutedIconColor,
    isDark,
  } = useAppTheme();

  const [teachers, setTeachers] = useState<TopTeacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const res = await api.get("/teachers/top-rated");
      setTeachers(res.data as TopTeacher[]);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to load leaderboard");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchLeaderboard();
  }, [fetchLeaderboard]);

  const renderTeacher = ({ item, index }: { item: TopTeacher; index: number }) => {
    const isTopThree = index < 3;
    const medalIcon = isTopThree ? MEDAL_ICONS[index] : null;
    const rankColor = isTopThree ? MEDAL_COLORS[index] : mutedIconColor;

    return (
      <View
        className="mb-2 flex-row items-center gap-3 rounded-2xl p-4"
        style={{
          backgroundColor: cardColor,
          borderWidth: 1,
          borderColor: isTopThree ? `${rankColor}40` : borderColor,
        }}
      >
        {/* Rank */}
        <View className="w-8 items-center">
          {medalIcon ? (
            <Text className="text-xl">{medalIcon}</Text>
          ) : (
            <Text className="text-sm font-bold" style={{ color: mutedIconColor }}>
              {index + 1}
            </Text>
          )}
        </View>

        {/* Avatar */}
        {item.userImage ? (
          <Image
            source={{ uri: item.userImage }}
            className="h-11 w-11 rounded-full"
            style={{ borderWidth: 2, borderColor: isTopThree ? rankColor : borderColor }}
            resizeMode="cover"
          />
        ) : (
          <View
            className="h-11 w-11 items-center justify-center rounded-full"
            style={{
              backgroundColor: primarySoftColor,
              borderWidth: 2,
              borderColor: isTopThree ? rankColor : borderColor,
            }}
          >
            <Text className="text-base font-bold" style={{ color: primaryColor }}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        {/* Info */}
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
              {item.name}
            </Text>
            {item.teacherModeVerified && (
              <Ionicons name="checkmark-circle" size={14} color={primaryColor} />
            )}
          </View>
          <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
            @{item.username}
          </Text>
          <View className="mt-1 flex-row items-center gap-3">
            <View className="flex-row items-center gap-1">
              <Ionicons name="star" size={11} color="#F59E0B" />
              <Text className="text-[11px] font-medium" style={{ color: "#F59E0B" }}>
                {item.overallScore.toFixed(1)}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Ionicons name="checkmark-done-outline" size={11} color={mutedIconColor} />
              <Text className="text-[11px] text-muted-foreground">
                {item.totalAnswered} answered
              </Text>
            </View>
          </View>
        </View>

        {/* Score badge */}
        <View
          className="items-center justify-center rounded-full px-3 py-1.5"
          style={{ backgroundColor: isTopThree ? `${rankColor}15` : primarySoftColor }}
        >
          <Text
            className="text-xs font-bold"
            style={{ color: isTopThree ? rankColor : primaryColor }}
          >
            {item.overallScore.toFixed(1)}
          </Text>
          <Text
            className="text-[9px]"
            style={{ color: isTopThree ? rankColor : primaryColor }}
          >
            score
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor }}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* Header */}
      <View
        style={{
          backgroundColor,
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
          paddingTop: Platform.OS === "ios" ? 54 : (StatusBar.currentHeight ?? 24) + 12,
          paddingBottom: 12,
          paddingHorizontal: 16,
        }}
      >
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={isDark ? "#fff" : "#111"} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">Leaderboard</Text>
            <Text className="text-[11px] text-muted-foreground">Top rated teachers</Text>
          </View>
          <View
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: primarySoftColor }}
          >
            <Text className="text-base">🏆</Text>
          </View>
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text className="mt-3 text-center text-base text-foreground">{error}</Text>
          <TouchableOpacity
            onPress={() => fetchLeaderboard()}
            className="mt-4 rounded-full px-6 py-2.5"
            style={{ backgroundColor: primaryColor }}
          >
            <Text className="font-semibold text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : teachers.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="mb-3 text-4xl">🏆</Text>
          <Text className="text-center text-base font-semibold text-foreground">
            No teachers yet
          </Text>
          <Text className="mt-1 text-center text-sm text-muted-foreground">
            The leaderboard will populate as teachers answer questions and earn ratings.
          </Text>
        </View>
      ) : (
        <FlatList
          data={teachers}
          keyExtractor={(t) => t.id}
          renderItem={renderTeacher}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                void fetchLeaderboard(true);
              }}
              tintColor={primaryColor}
            />
          }
          ListHeaderComponent={
            <View
              className="mb-4 rounded-2xl p-4"
              style={{ backgroundColor: primarySoftColor }}
            >
              <Text
                className="text-center text-sm font-semibold"
                style={{ color: primaryColor }}
              >
                Rankings update based on overall score and total questions answered.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
