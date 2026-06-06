import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Image,
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

type TransactionRecord = {
  _id: string;
  userId: { _id: string; name: string; email: string; role: string } | null;
  type: string;
  amount: number;
  status: "PENDING" | "COMPLETED" | "FAILED" | string;
  gateway?: string;
  transactionId?: string;
  transactorName?: string;
  planSlug?: string;
  screenshotUrl?: string;
  createdAt: string;
  meta?: { adminNote?: string | null };
  metadata?: { courseName?: string };
};

type StatusFilter = "ALL" | "PENDING" | "COMPLETED" | "FAILED";

const TYPE_LABELS: Record<string, string> = {
  SUBSCRIPTION_MANUAL: "Manual Subscription",
  COURSE_PURCHASE: "Course Purchase",
  CHAPTER_PURCHASE: "Chapter Purchase",
};

const STATUS_META: Record<string, { color: string; bg: string }> = {
  PENDING: { color: "#D97706", bg: "rgba(217,119,6,0.12)" },
  COMPLETED: { color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  FAILED: { color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
};

function isManualReview(type: string) {
  return (
    type === "SUBSCRIPTION_MANUAL" ||
    type === "COURSE_PURCHASE" ||
    type === "CHAPTER_PURCHASE"
  );
}

function formatDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export default function AdminTransactionsScreen() {
  const insets = useSafeAreaInsets();
  const { statusBarStyle, backgroundColor, iconColor, primaryColor } = useAppTheme();

  const [items, setItems] = useState<TransactionRecord[]>(
    () => readCache<TransactionRecord[]>("transactions") ?? [],
  );
  const [loading, setLoading] = useState(() => readCache("transactions") === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [viewImage, setViewImage] = useState<string | null>(null);

  // action modal state
  const [action, setAction] = useState<{
    tx: TransactionRecord;
    kind: "approve" | "refund";
  } | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/mobile/admin/transactions?limit=80");
      const data = Array.isArray(res.data?.transactions) ? res.data.transactions : [];
      setItems(data);
      writeCache("transactions", data);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to load transactions",
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

  const filtered = useMemo(() => {
    if (filter === "ALL") return items;
    return items.filter((t) => t.status === filter);
  }, [items, filter]);

  const submitAction = useCallback(async () => {
    if (!action) return;
    setSubmitting(true);
    try {
      const path = `/mobile/admin/transactions/${action.tx._id}/${action.kind}`;
      await api.post(path, { adminNote: note.trim() || null });
      const newStatus = action.kind === "approve" ? "COMPLETED" : "FAILED";
      setItems((prev) =>
        prev.map((t) => (t._id === action.tx._id ? { ...t, status: newStatus } : t)),
      );
      Toast.show({
        type: "success",
        text1: action.kind === "approve" ? "Approved" : "Rejected",
        position: "bottom",
      });
      setAction(null);
      setNote("");
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Action failed",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setSubmitting(false);
    }
  }, [action, note]);

  const renderItem = useCallback(
    ({ item }: { item: TransactionRecord }) => {
      const statusMeta = STATUS_META[item.status] ?? {
        color: iconColor,
        bg: "rgba(120,120,120,0.12)",
      };
      const canApprove = item.status === "PENDING" && isManualReview(item.type);
      const canRefund =
        item.status === "PENDING" &&
        (item.type === "SUBSCRIPTION_MANUAL" || item.type === "COURSE_PURCHASE");
      const typeLabel = TYPE_LABELS[item.type] ?? item.type;

      return (
        <View className="mb-3 rounded-2xl border border-border bg-card p-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-[15px] font-semibold text-foreground">
                {item.userId?.name ?? item.transactorName ?? "Unknown"}
              </Text>
              {item.userId?.email ? (
                <Text className="text-[12px] text-muted-foreground">
                  {item.userId.email}
                </Text>
              ) : null}
            </View>
            <View
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: statusMeta.bg }}
            >
              <Text className="text-[11px] font-bold" style={{ color: statusMeta.color }}>
                {item.status}
              </Text>
            </View>
          </View>

          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-[13px] text-muted-foreground">{typeLabel}</Text>
            <Text className="text-[15px] font-bold text-foreground">
              NPR {item.amount}
            </Text>
          </View>

          {item.metadata?.courseName ? (
            <Text className="mt-1 text-[12px] text-muted-foreground">
              {item.metadata.courseName}
            </Text>
          ) : null}

          <View className="mt-1 flex-row items-center justify-between">
            <Text className="text-[11px] text-muted-foreground">
              {item.transactionId ? `#${item.transactionId}` : ""}
            </Text>
            <Text className="text-[11px] text-muted-foreground">
              {formatDate(item.createdAt)}
            </Text>
          </View>

          {item.screenshotUrl ? (
            <TouchableOpacity
              onPress={() => setViewImage(item.screenshotUrl!)}
              activeOpacity={0.85}
              className="mt-3 flex-row items-center gap-1.5 self-start rounded-full border border-border px-3 py-1.5"
            >
              <Ionicons name="image-outline" size={14} color={iconColor} />
              <Text className="text-[12px] font-medium text-foreground">View proof</Text>
            </TouchableOpacity>
          ) : null}

          {item.meta?.adminNote ? (
            <Text className="mt-2 text-[12px] italic text-muted-foreground">
              Note: {item.meta.adminNote}
            </Text>
          ) : null}

          {canApprove || canRefund ? (
            <View className="mt-3 flex-row gap-2">
              {canApprove ? (
                <TouchableOpacity
                  onPress={() => {
                    setNote("");
                    setAction({ tx: item, kind: "approve" });
                  }}
                  activeOpacity={0.85}
                  className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full py-2.5"
                  style={{ backgroundColor: "rgba(16,185,129,0.12)" }}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color="#10B981" />
                  <Text
                    className="text-[13px] font-semibold"
                    style={{ color: "#10B981" }}
                  >
                    Approve
                  </Text>
                </TouchableOpacity>
              ) : null}
              {canRefund ? (
                <TouchableOpacity
                  onPress={() => {
                    setNote("");
                    setAction({ tx: item, kind: "refund" });
                  }}
                  activeOpacity={0.85}
                  className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full py-2.5"
                  style={{ backgroundColor: "rgba(239,68,68,0.12)" }}
                >
                  <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
                  <Text
                    className="text-[13px] font-semibold"
                    style={{ color: "#EF4444" }}
                  >
                    Reject
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      );
    },
    [iconColor],
  );

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* Header */}
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
              Transactions
            </Text>
            <Text className="text-[12px] text-muted-foreground">
              {filtered.length} shown
            </Text>
          </View>
        </View>

        {/* Filter chips */}
        <View className="mt-3 flex-row gap-2">
          {(["ALL", "PENDING", "COMPLETED", "FAILED"] as StatusFilter[]).map((f) => {
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
                  {f.charAt(0) + f.slice(1).toLowerCase()}
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
              <Ionicons name="receipt-outline" size={40} color="#9CA3AF" />
              <Text className="mt-3 text-[14px] text-muted-foreground">
                No transactions.
              </Text>
            </View>
          }
        />
      )}

      {/* Proof image modal */}
      <Modal
        visible={!!viewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setViewImage(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/90 p-4">
          <TouchableOpacity
            onPress={() => setViewImage(null)}
            className="absolute right-5 top-12 z-10 h-10 w-10 items-center justify-center rounded-full bg-white/15"
            activeOpacity={0.85}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          {viewImage ? (
            <Image
              source={{ uri: viewImage }}
              style={{ width: "100%", height: "80%" }}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>

      {/* Approve / Reject modal with optional note */}
      <Modal
        visible={!!action}
        transparent
        animationType="fade"
        onRequestClose={() => !submitting && setAction(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 p-6">
          <View className="w-full rounded-3xl border border-border bg-card p-5">
            <Text className="text-[17px] font-bold text-foreground">
              {action?.kind === "approve"
                ? "Approve transaction?"
                : "Reject transaction?"}
            </Text>
            <Text className="mt-1 text-[13px] text-muted-foreground">
              {action?.kind === "approve"
                ? `This will unlock access for ${action?.tx.userId?.name ?? "the user"}.`
                : `This keeps the record but does not grant access.`}
            </Text>

            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Optional note (sent in notification)"
              placeholderTextColor="#6B7280"
              multiline
              className="mt-3 min-h-[64px] rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
            />

            <View className="mt-4 flex-row gap-2">
              <TouchableOpacity
                onPress={() => {
                  if (!submitting) {
                    setAction(null);
                    setNote("");
                  }
                }}
                activeOpacity={0.85}
                className="flex-1 items-center rounded-full border border-border py-3"
              >
                <Text className="text-[14px] font-semibold text-foreground">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitAction}
                disabled={submitting}
                activeOpacity={0.85}
                className="flex-1 items-center rounded-full py-3"
                style={{
                  backgroundColor: action?.kind === "approve" ? "#10B981" : "#EF4444",
                }}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-[14px] font-semibold text-white">
                    {action?.kind === "approve" ? "Approve" : "Reject"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
