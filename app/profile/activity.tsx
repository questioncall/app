import { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { api } from "@/lib/api";
import { useAppTheme } from "@/hooks/use-app-theme";
import {
  ActivityPeriod,
  selectIsActivityStale,
  setActivityData,
  setActivityError,
  setActivityLoading,
  setActivityPeriod,
  setActivityRefreshing,
} from "@/store/slices/activitySlice";

const PERIODS: { label: string; value: ActivityPeriod; range: number }[] = [
  { label: "14D", value: "day", range: 14 },
  { label: "12W", value: "week", range: 12 },
  { label: "12M", value: "month", range: 12 },
  { label: "5Y", value: "year", range: 5 },
];

export default function ActivityScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.user.data);
  const activity = useAppSelector((s) => s.activity);
  const { statusBarStyle, backgroundColor, iconColor, primaryColor, primarySoftColor } =
    useAppTheme();
  const isTeacher = user?.role === "TEACHER";

  const loadActivity = useCallback(
    async (targetPeriod = activity.period, force = false) => {
      if (!user?._id) return;
      const range = PERIODS.find((item) => item.value === targetPeriod)?.range ?? 12;
      const cacheMatches =
        activity.loadedForUserId === user._id && activity.period === targetPeriod;

      if (!force && cacheMatches && !selectIsActivityStale(activity.lastFetchedAt)) {
        return;
      }

      dispatch(setActivityLoading(true));
      try {
        const res = await api.get("/users/activity", {
          params: {
            userId: user._id,
            period: targetPeriod,
            range,
          },
        });

        dispatch(
          setActivityData({
            userId: user._id,
            period: targetPeriod,
            range,
            role: res.data?.role ?? user.role,
            dataPoints: Array.isArray(res.data?.dataPoints) ? res.data.dataPoints : [],
            summary: res.data?.summary ?? null,
            typeBreakdown: Array.isArray(res.data?.typeBreakdown)
              ? res.data.typeBreakdown
              : [],
            rangeMessage: res.data?.rangeMessage ?? null,
          }),
        );
      } catch (err: any) {
        dispatch(
          setActivityError(err?.response?.data?.error ?? "Unable to load activity."),
        );
      }
    },
    [
      activity.lastFetchedAt,
      activity.loadedForUserId,
      activity.period,
      dispatch,
      user?._id,
      user?.role,
    ],
  );

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  async function handleRefresh() {
    dispatch(setActivityRefreshing(true));
    await loadActivity(activity.period, true);
  }

  function choosePeriod(period: ActivityPeriod) {
    dispatch(setActivityPeriod(period));
    void loadActivity(period, true);
  }

  const summary = activity.summary ?? {};
  const headlineValue = isTeacher
    ? (summary.netEarning ?? user?.pointBalance ?? 0)
    : (summary.totalAsked ?? user?.questionsAsked ?? 0);
  const maxBar = Math.max(
    1,
    ...activity.dataPoints.map((point) =>
      isTeacher
        ? Math.max(point.net ?? 0, point.earned ?? 0)
        : (point.questionsAsked ?? 0),
    ),
  );

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={activity.isRefreshing}
            onRefresh={handleRefresh}
            tintColor={iconColor}
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="px-5 pt-14">
          <View className="mb-6 flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => router.back()}
              className="h-11 w-11 items-center justify-center rounded-full bg-secondary"
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={20} color={iconColor} />
            </TouchableOpacity>
            <Text className="text-base font-bold text-foreground">My Activity</Text>
            <View className="h-11 w-11" />
          </View>

          <View
            className="rounded-[28px] border border-border p-5"
            style={{ backgroundColor: primarySoftColor }}
          >
            <View className="flex-row items-start justify-between">
              <View>
                <Text className="text-sm font-medium text-muted-foreground">
                  {isTeacher ? "Net points" : "Questions asked"}
                </Text>
                <Text className="mt-2 text-[38px] font-bold text-foreground">
                  {headlineValue.toLocaleString()}
                </Text>
              </View>
              <View
                className="h-12 w-12 items-center justify-center rounded-2xl"
                style={{ backgroundColor: primaryColor }}
              >
                <Ionicons
                  name={isTeacher ? "trending-up-outline" : "help-buoy-outline"}
                  size={23}
                  color="#FFFFFF"
                />
              </View>
            </View>

            <View className="mt-5 flex-row gap-2">
              {PERIODS.map((period) => {
                const active = period.value === activity.period;
                return (
                  <TouchableOpacity
                    key={period.value}
                    onPress={() => choosePeriod(period.value)}
                    className="flex-1 items-center rounded-full py-2"
                    style={{
                      backgroundColor: active ? primaryColor : "rgba(255,255,255,0.45)",
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        active ? "text-white" : "text-foreground"
                      }`}
                    >
                      {period.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {activity.error ? (
            <View className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
              <Text className="text-sm font-medium text-red-600 dark:text-red-300">
                {activity.error}
              </Text>
            </View>
          ) : null}

          {activity.rangeMessage ? (
            <View className="mt-4 rounded-2xl border border-border bg-card p-4">
              <Text className="text-sm leading-6 text-muted-foreground">
                {activity.rangeMessage}
              </Text>
            </View>
          ) : null}

          <View className="mt-5 flex-row gap-3">
            <StatCard
              label={isTeacher ? "Earned" : "Solved"}
              value={isTeacher ? (summary.totalEarned ?? 0) : (summary.totalSolved ?? 0)}
            />
            <StatCard
              label={isTeacher ? "Penalties" : "Active days"}
              value={
                isTeacher ? (summary.totalPenalty ?? 0) : (summary.totalActiveDays ?? 0)
              }
            />
          </View>

          <View className="mt-5 rounded-[24px] border border-border bg-card p-5">
            <View className="mb-5 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-card-foreground">
                {isTeacher ? "Earning trend" : "Question trend"}
              </Text>
              {activity.isLoading ? <ActivityIndicator color={iconColor} /> : null}
            </View>

            {activity.dataPoints.length === 0 && !activity.isLoading ? (
              <View className="items-center py-10">
                <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                  <Ionicons name="stats-chart-outline" size={26} color={iconColor} />
                </View>
                <Text className="text-center text-sm text-muted-foreground">
                  No activity found for this period.
                </Text>
              </View>
            ) : (
              <View className="h-48 flex-row items-end gap-2">
                {activity.dataPoints.slice(-14).map((point) => {
                  const value = isTeacher
                    ? Math.max(point.net ?? 0, point.earned ?? 0)
                    : (point.questionsAsked ?? 0);
                  return (
                    <View key={point.date} className="flex-1 items-center justify-end">
                      <View
                        className="w-full rounded-t-lg"
                        style={{
                          minHeight: 6,
                          height: `${Math.max(4, (value / maxBar) * 100)}%`,
                          backgroundColor: primaryColor,
                        }}
                      />
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          <View className="mt-5 rounded-[24px] border border-border bg-card p-5">
            <Text className="mb-4 text-lg font-bold text-card-foreground">Breakdown</Text>
            {activity.typeBreakdown.length === 0 ? (
              <Text className="text-sm text-muted-foreground">Nothing to show yet.</Text>
            ) : (
              activity.typeBreakdown.slice(0, 5).map((item) => (
                <View key={item._id} className="mb-3 flex-row items-center">
                  <View
                    className="mr-3 h-9 w-9 items-center justify-center rounded-xl"
                    style={{ backgroundColor: primarySoftColor }}
                  >
                    <Ionicons name="ellipse" size={10} color={primaryColor} />
                  </View>
                  <Text className="flex-1 text-sm font-medium text-card-foreground">
                    {item._id.replace(/_/g, " ")}
                  </Text>
                  <Text className="text-sm font-bold text-card-foreground">
                    {(item.total ?? item.count).toLocaleString()}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-1 rounded-2xl border border-border bg-card p-4">
      <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </Text>
      <Text className="mt-2 text-2xl font-bold text-card-foreground">
        {value.toLocaleString()}
      </Text>
    </View>
  );
}
