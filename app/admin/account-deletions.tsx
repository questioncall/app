import { useCallback, useEffect, useMemo, useState } from "react";
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

import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";
import { getRequestErrorMessage } from "@/lib/server-response";
import { readCache, writeCache } from "@/lib/admin-cache";

type DeletionRow = {
  _id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  reason?: string | null;
  deletedAt?: string | null;
  status: "pending" | "recovered" | "purged" | string;
  recoveredAt?: string | null;
  purgedAt?: string | null;
  graceExpiresAt?: string | null;
};

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: "#D97706", bg: "rgba(217,119,6,0.12)", label: "Pending" },
  recovered: { color: "#10B981", bg: "rgba(16,185,129,0.12)", label: "Recovered" },
  purged: { color: "#EF4444", bg: "rgba(239,68,68,0.12)", label: "Purged" },
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function AdminAccountDeletionsScreen() {
  const insets = useSafeAreaInsets();
  const { statusBarStyle, backgroundColor, iconColor, primaryColor } = useAppTheme();

  const [items, setItems] = useState<DeletionRow[]>(
    () => readCache<DeletionRow[]>("account-deletions") ?? [],
  );
  const [loading, setLoading] = useState(
    () => readCache("account-deletions") === undefined,
  );
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/mobile/admin/account-deletions");
      const data = Array.isArray(res.data?.requests) ? res.data.requests : [];
      setItems(data);
      writeCache("account-deletions", data);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to load deletions",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({
      total: items.length,
      pending: items.filter((r) => r.status === "pending").length,
      recovered: items.filter((r) => r.status === "recovered").length,
      purged: items.filter((r) => r.status === "purged").length,
    }),
    [items],
  );

  const renderItem = useCallback(
    ({ item }: { item: DeletionRow }) => {
      const meta = STATUS_META[item.status] ?? {
        color: iconColor,
        bg: "rgba(120,120,120,0.12)",
        label: item.status,
      };
      return (
        <View className="mb-3 rounded-2xl border border-border bg-card p-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-[15px] font-semibold text-foreground">
                {item.name || "Unknown"}
              </Text>
              <Text className="text-[12px] text-muted-foreground">
                {item.email || "—"}
              </Text>
              {item.role ? (
                <Text className="text-[12px] text-muted-foreground">{item.role}</Text>
              ) : null}
            </View>
            <View
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: meta.bg }}
            >
              <Text className="text-[11px] font-bold" style={{ color: meta.color }}>
                {meta.label}
              </Text>
            </View>
          </View>

          {item.reason ? (
            <Text className="mt-2 text-[13px] text-foreground">{item.reason}</Text>
          ) : (
            <Text className="mt-2 text-[13px] italic text-muted-foreground">
              No reason given
            </Text>
          )}

          <Text className="mt-2 text-[11px] text-muted-foreground">
            Deleted {formatDateTime(item.deletedAt)}
          </Text>
          {item.status === "pending" && item.graceExpiresAt ? (
            <Text className="text-[11px] text-muted-foreground">
              Recoverable until {formatDateTime(item.graceExpiresAt)}
            </Text>
          ) : null}
          {item.status === "recovered" && item.recoveredAt ? (
            <Text className="text-[11px] text-muted-foreground">
              Recovered {formatDateTime(item.recoveredAt)}
            </Text>
          ) : null}
          {item.status === "purged" && item.purgedAt ? (
            <Text className="text-[11px] text-muted-foreground">
              Purged {formatDateTime(item.purgedAt)}
            </Text>
          ) : null}
        </View>
      );
    },
    [iconColor],
  );

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      <View
        className="border-b border-border px-5 pb-3"
        style={{ paddingTop: Math.max(insets.top + 8, 36) }}
      >
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={20} color={iconColor} />
          </TouchableOpacity>
          <View>
            <Text className="text-[18px] font-bold tracking-tight text-foreground">
              Account Deletions
            </Text>
            <Text className="text-[12px] text-muted-foreground">
              {counts.pending} pending · {counts.recovered} recovered · {counts.purged}{" "}
              purged
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
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
                void load();
              }}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Ionicons name="person-remove-outline" size={40} color="#9CA3AF" />
              <Text className="mt-3 text-[14px] text-muted-foreground">
                No account deletions yet.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
