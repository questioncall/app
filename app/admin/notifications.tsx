import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ComponentProps } from "react";

import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";
import { getRequestErrorMessage } from "@/lib/server-response";
import { readCache, writeCache } from "@/lib/admin-cache";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type AdminNotification = {
  id: string;
  category: "WITHDRAWAL" | "PAYMENT" | "EXPIRY" | string;
  title: string;
  message: string;
  createdAt: string;
  href: string;
  isRead: boolean;
};

const CATEGORY_META: Record<string, { icon: IoniconName; color: string; bg: string }> = {
  WITHDRAWAL: { icon: "cash-outline", color: "#D97706", bg: "rgba(217,119,6,0.12)" },
  PAYMENT: { icon: "card-outline", color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  EXPIRY: { icon: "time-outline", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
};

function timeAgo(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString();
}

export default function AdminNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { statusBarStyle, backgroundColor, iconColor, primaryColor } = useAppTheme();

  const [items, setItems] = useState<AdminNotification[]>(
    () => readCache<AdminNotification[]>("notifications") ?? [],
  );
  const [loading, setLoading] = useState(() => readCache("notifications") === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState(false);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async (showHistory: boolean) => {
    try {
      const res = await api.get(
        `/mobile/admin/notifications?history=${showHistory ? "true" : "false"}`,
      );
      const data = Array.isArray(res.data?.notifications) ? res.data.notifications : [];
      setItems(data);
      // Only the default (non-history) feed is prefetched/seeded.
      if (!showHistory) writeCache("notifications", data);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to load notifications",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(history);
  }, [load, history]);

  const markRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    setMarking(true);
    try {
      await api.post("/mobile/admin/notifications/read", { ids });
      setItems((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, isRead: true } : n)),
      );
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to mark read",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setMarking(false);
    }
  }, []);

  const markAll = useCallback(() => {
    const unread = items.filter((n) => !n.isRead).map((n) => n.id);
    void markRead(unread);
  }, [items, markRead]);

  const renderItem = useCallback(
    ({ item }: { item: AdminNotification }) => {
      const meta = CATEGORY_META[item.category] ?? {
        icon: "notifications-outline" as IoniconName,
        color: primaryColor,
        bg: `${primaryColor}1A`,
      };
      return (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            if (!item.isRead) void markRead([item.id]);
          }}
          className="mb-3 flex-row gap-3 rounded-2xl border border-border bg-card p-4"
          style={!item.isRead ? { borderColor: `${primaryColor}55` } : undefined}
        >
          <View
            className="h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: meta.bg }}
          >
            <Ionicons name={meta.icon} size={20} color={meta.color} />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center justify-between">
              <Text
                className="text-[14px] font-semibold text-foreground"
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text className="ml-2 text-[11px] text-muted-foreground">
                {timeAgo(item.createdAt)}
              </Text>
            </View>
            <Text className="mt-0.5 text-[13px] text-muted-foreground" numberOfLines={3}>
              {item.message}
            </Text>
          </View>
          {!item.isRead ? (
            <View
              className="mt-1 h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: primaryColor }}
            />
          ) : null}
        </TouchableOpacity>
      );
    },
    [markRead, primaryColor],
  );

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      <View
        className="border-b border-border px-5 pb-3"
        style={{ paddingTop: Math.max(insets.top + 8, 36) }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-back" size={20} color={iconColor} />
            </TouchableOpacity>
            <Text className="text-[18px] font-bold tracking-tight text-foreground">
              Notifications
            </Text>
          </View>

          <TouchableOpacity
            onPress={markAll}
            disabled={marking}
            activeOpacity={0.85}
            className="rounded-full border border-border px-3 py-1.5"
          >
            {marking ? (
              <ActivityIndicator color={primaryColor} />
            ) : (
              <Text className="text-[12px] font-semibold" style={{ color: primaryColor }}>
                Mark all read
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View className="mt-3 flex-row gap-2">
          {[
            { key: false, label: "Unread" },
            { key: true, label: "All" },
          ].map((tab) => {
            const active = history === tab.key;
            return (
              <TouchableOpacity
                key={String(tab.key)}
                onPress={() => setHistory(tab.key)}
                activeOpacity={0.85}
                className="rounded-full border px-3 py-1.5"
                style={{
                  borderColor: active ? primaryColor : "transparent",
                  backgroundColor: active ? `${primaryColor}1A` : "rgba(120,120,120,0.1)",
                }}
              >
                <Text
                  className="text-[12px] font-semibold"
                  style={{ color: active ? primaryColor : iconColor }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom + 24, 32),
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(history);
              }}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Ionicons name="checkmark-done-outline" size={40} color="#9CA3AF" />
              <Text className="mt-3 text-[14px] text-muted-foreground">
                {history ? "No notifications." : "You're all caught up."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
