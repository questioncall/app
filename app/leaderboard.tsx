import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { api } from "@/lib/api";
import { useAppTheme } from "@/hooks/use-app-theme";

interface TopTeacher {
  id: string;
  name: string;
  username: string;
  userImage?: string;
  overallScore: number;
  totalAnswered: number;
  teacherModeVerified: boolean;
}

const MEDAL_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];

function TeacherRow({ teacher, rank }: { teacher: TopTeacher; rank: number }) {
  const { cardColor, borderColor, primaryColor, primarySoftColor } = useAppTheme();
  const initials = teacher.name.slice(0, 2).toUpperCase();
  const isMedal = rank <= 3;
  const medalColor = MEDAL_COLORS[rank - 1];

  return (
    <View
      className="mb-3 overflow-hidden rounded-2xl border"
      style={{ backgroundColor: cardColor, borderColor }}
    >
      <View className="flex-row items-center px-4 py-3.5">
        {/* Rank */}
        <View
          className="mr-4 h-9 w-9 items-center justify-center rounded-full"
          style={{
            backgroundColor: isMedal ? `${medalColor}22` : primarySoftColor,
          }}
        >
          {isMedal ? (
            <Text className="text-base font-bold" style={{ color: medalColor }}>
              {rank}
            </Text>
          ) : (
            <Text className="text-sm font-semibold text-muted-foreground">{rank}</Text>
          )}
        </View>

        {/* Avatar */}
        <View style={{ width: 44, height: 44 }}>
          {teacher.userImage ? (
            <Image
              source={{ uri: teacher.userImage }}
              style={{ width: 44, height: 44, borderRadius: 22 }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: primaryColor,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text className="text-sm font-bold text-white">{initials}</Text>
            </View>
          )}
          {teacher.teacherModeVerified && (
            <View
              className="absolute -bottom-0.5 -right-0.5 h-5 w-5 items-center justify-center rounded-full"
              style={{ backgroundColor: "#10B981" }}
            >
              <Ionicons name="checkmark" size={11} color="#FFF" />
            </View>
          )}
        </View>

        {/* Info */}
        <View className="ml-3 flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
              {teacher.name}
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground">@{teacher.username}</Text>
        </View>

        {/* Stats */}
        <View className="items-end">
          <View className="flex-row items-center gap-1">
            <Ionicons name="star" size={13} color="#F59E0B" />
            <Text className="text-sm font-bold text-foreground">
              {teacher.overallScore.toFixed(1)}
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground">
            {teacher.totalAnswered} answered
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function LeaderboardScreen() {
  const { statusBarStyle, backgroundColor, primaryColor } = useAppTheme();
  const [teachers, setTeachers] = useState<TopTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTeachers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await api.get("/teachers/top-rated");
      setTeachers(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError("Failed to load leaderboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchTeachers();
  }, [fetchTeachers]);

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      <View className="flex-row items-center px-4 pb-2 pt-14">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-secondary"
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color={primaryColor} />
        </TouchableOpacity>
        <Text className="flex-1 text-2xl font-bold text-foreground">Leaderboard</Text>
        <Ionicons name="trophy" size={22} color="#F59E0B" />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text className="mt-3 text-center text-base text-muted-foreground">
            {error}
          </Text>
          <TouchableOpacity
            onPress={() => fetchTeachers()}
            className="mt-4 rounded-full px-6 py-3"
            style={{ backgroundColor: primaryColor }}
          >
            <Text className="font-semibold text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={teachers}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <TeacherRow teacher={item} rank={index + 1} />}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 32,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchTeachers(true)}
              tintColor={primaryColor}
            />
          }
          ListHeaderComponent={
            <Text className="mb-4 text-sm text-muted-foreground">
              Top teachers ranked by overall score and answers.
            </Text>
          }
          ListEmptyComponent={
            <View className="mt-20 items-center">
              <Ionicons name="trophy-outline" size={48} color="#A8A29E" />
              <Text className="mt-3 text-muted-foreground">No teachers yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
