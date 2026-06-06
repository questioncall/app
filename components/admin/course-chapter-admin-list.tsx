import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Switch,
  Alert,
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

type Kind = "courses" | "chapters";

type Item = {
  _id: string;
  title: string;
  subject?: string;
  level?: string;
  pricingModel?: string;
  price?: number;
  status: string;
  isFeatured?: boolean;
  instructorName?: string;
  instructorRole?: string;
  enrollmentCount?: number;
  createdAt?: string | null;
};

const STATUSES = ["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"] as const;
type StatusFilter = "ALL" | (typeof STATUSES)[number];

const STATUS_META: Record<string, { color: string; bg: string }> = {
  DRAFT: { color: "#888", bg: "rgba(120,120,120,0.14)" },
  ACTIVE: { color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  COMPLETED: { color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
  ARCHIVED: { color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
};

const PRICING_LABEL: Record<string, string> = {
  FREE: "Free",
  SUBSCRIPTION_INCLUDED: "Subscription",
  PAID: "Paid",
};

export function CourseChapterAdminList({ kind }: { kind: Kind }) {
  const insets = useSafeAreaInsets();
  const { statusBarStyle, backgroundColor, iconColor, primaryColor } = useAppTheme();

  const title = kind === "courses" ? "Courses" : "Chapters";
  const emptyIcon = kind === "courses" ? "book-outline" : "layers-outline";

  const [items, setItems] = useState<Item[]>(() => readCache<Item[]>(kind) ?? []);
  const [loading, setLoading] = useState(() => readCache(kind) === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [manage, setManage] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/mobile/admin/${kind}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setItems(data);
      writeCache(kind, data);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: `Failed to load ${kind}`,
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return items;
    return items.filter((i) => i.status === filter);
  }, [items, filter]);

  const patchItem = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      setBusy(true);
      try {
        await api.patch(`/${kind}/${id}`, body);
        setItems((prev) => prev.map((i) => (i._id === id ? { ...i, ...body } : i)));
        setManage((m) => (m && m._id === id ? { ...m, ...body } : m));
      } catch (err) {
        Toast.show({
          type: "error",
          text1: "Update failed",
          text2: getRequestErrorMessage(err, "Please try again."),
          position: "bottom",
        });
      } finally {
        setBusy(false);
      }
    },
    [kind],
  );

  const deleteItem = useCallback(
    (item: Item) => {
      Alert.alert(
        `Delete ${kind.slice(0, -1)}?`,
        `"${item.title}" will be permanently removed.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              setBusy(true);
              try {
                await api.delete(`/${kind}/${item._id}`);
                setItems((prev) => prev.filter((i) => i._id !== item._id));
                setManage(null);
                Toast.show({ type: "success", text1: "Deleted", position: "bottom" });
              } catch (err) {
                Toast.show({
                  type: "error",
                  text1: "Delete failed",
                  text2: getRequestErrorMessage(err, "Please try again."),
                  position: "bottom",
                });
              } finally {
                setBusy(false);
              }
            },
          },
        ],
      );
    },
    [kind],
  );

  const renderItem = useCallback(
    ({ item }: { item: Item }) => {
      const meta = STATUS_META[item.status] ?? {
        color: iconColor,
        bg: "rgba(120,120,120,0.12)",
      };
      return (
        <TouchableOpacity
          onPress={() => setManage(item)}
          activeOpacity={0.85}
          className="mb-3 rounded-2xl border border-border bg-card p-4"
        >
          <View className="flex-row items-start justify-between">
            <Text
              className="flex-1 pr-3 text-[15px] font-semibold text-foreground"
              numberOfLines={2}
            >
              {item.title}
            </Text>
            <View
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: meta.bg }}
            >
              <Text className="text-[11px] font-bold" style={{ color: meta.color }}>
                {item.status}
              </Text>
            </View>
          </View>

          <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1">
            {item.subject ? (
              <Text className="text-[12px] text-muted-foreground">{item.subject}</Text>
            ) : null}
            {item.level ? (
              <Text className="text-[12px] text-muted-foreground">{item.level}</Text>
            ) : null}
            <Text className="text-[12px] text-muted-foreground">
              {PRICING_LABEL[item.pricingModel ?? ""] ?? item.pricingModel}
              {item.pricingModel === "PAID" && item.price ? ` · ${item.price} NPR` : ""}
            </Text>
            {item.isFeatured ? (
              <View className="flex-row items-center gap-1">
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text className="text-[12px]" style={{ color: "#F59E0B" }}>
                  Featured
                </Text>
              </View>
            ) : null}
          </View>

          <View className="mt-1 flex-row items-center justify-between">
            <Text className="text-[11px] text-muted-foreground">
              {item.instructorName ?? "—"}
              {item.instructorRole ? ` · ${item.instructorRole}` : ""}
            </Text>
            <Text className="text-[11px] text-muted-foreground">
              {item.enrollmentCount ?? 0} enrolled
            </Text>
          </View>
        </TouchableOpacity>
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
              {title}
            </Text>
            <Text className="text-[12px] text-muted-foreground">
              {filtered.length} shown
            </Text>
          </View>
        </View>

        <View className="mt-3 flex-row flex-wrap gap-2">
          {(["ALL", ...STATUSES] as StatusFilter[]).map((f) => {
            const active = filter === f;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
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
                  {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
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
          data={filtered}
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
              <Ionicons name={emptyIcon} size={40} color="#9CA3AF" />
              <Text className="mt-3 text-[14px] text-muted-foreground">No {kind}.</Text>
            </View>
          }
        />
      )}

      {/* Manage modal */}
      <Modal
        visible={!!manage}
        transparent
        animationType="slide"
        onRequestClose={() => !busy && setManage(null)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View
            className="rounded-t-3xl border border-border bg-card p-5"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <Text
                className="flex-1 pr-3 text-[16px] font-bold text-foreground"
                numberOfLines={1}
              >
                {manage?.title}
              </Text>
              <TouchableOpacity onPress={() => !busy && setManage(null)}>
                <Ionicons name="close" size={22} color={iconColor} />
              </TouchableOpacity>
            </View>

            <Text className="mb-2 text-[12px] font-medium text-foreground">Status</Text>
            <View className="flex-row flex-wrap gap-2">
              {STATUSES.map((s) => {
                const active = manage?.status === s;
                return (
                  <TouchableOpacity
                    key={s}
                    disabled={busy}
                    onPress={() => manage && patchItem(manage._id, { status: s })}
                    activeOpacity={0.85}
                    className="rounded-full border px-3 py-1.5"
                    style={{
                      borderColor: active ? primaryColor : "transparent",
                      backgroundColor: active
                        ? `${primaryColor}1A`
                        : "rgba(120,120,120,0.1)",
                    }}
                  >
                    <Text
                      className="text-[12px] font-semibold"
                      style={{ color: active ? primaryColor : iconColor }}
                    >
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View className="mt-4 flex-row items-center justify-between">
              <Text className="text-[14px] font-medium text-foreground">Featured</Text>
              <Switch
                value={Boolean(manage?.isFeatured)}
                disabled={busy}
                onValueChange={(val) => {
                  if (manage) void patchItem(manage._id, { isFeatured: val });
                }}
                trackColor={{ true: primaryColor }}
              />
            </View>

            <TouchableOpacity
              onPress={() => manage && deleteItem(manage)}
              disabled={busy}
              activeOpacity={0.85}
              className="mt-5 flex-row items-center justify-center gap-1.5 rounded-full py-3.5"
              style={{ backgroundColor: "rgba(239,68,68,0.12)" }}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
              <Text className="text-[14px] font-semibold" style={{ color: "#EF4444" }}>
                Delete {kind.slice(0, -1)}
              </Text>
            </TouchableOpacity>

            {busy ? (
              <View className="mt-3 items-center">
                <ActivityIndicator color={primaryColor} />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}
