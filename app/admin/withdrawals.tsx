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

type WithdrawalRecord = {
  _id: string;
  teacherId: {
    _id: string;
    name: string;
    email: string;
    username?: string;
    role: string;
  } | null;
  pointsRequested: number;
  nprEquivalent?: number;
  esewaNumber?: string;
  status: "PENDING" | "COMPLETED" | "REJECTED" | string;
  transactionId?: string;
  amountSent?: number;
  adminNote?: string | null;
  createdAt: string;
};

type StatusFilter = "ALL" | "PENDING" | "COMPLETED" | "REJECTED";

const STATUS_META: Record<string, { color: string; bg: string }> = {
  PENDING: { color: "#D97706", bg: "rgba(217,119,6,0.12)" },
  COMPLETED: { color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  REJECTED: { color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
};

function formatDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export default function AdminWithdrawalsScreen() {
  const insets = useSafeAreaInsets();
  const { statusBarStyle, backgroundColor, iconColor, primaryColor } = useAppTheme();

  const [items, setItems] = useState<WithdrawalRecord[]>(
    () => readCache<WithdrawalRecord[]>("withdrawals") ?? [],
  );
  const [loading, setLoading] = useState(() => readCache("withdrawals") === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("ALL");

  const [completeTarget, setCompleteTarget] = useState<WithdrawalRecord | null>(null);
  const [rejectTarget, setRejectTarget] = useState<WithdrawalRecord | null>(null);
  const [txnId, setTxnId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/mobile/admin/withdrawals?limit=80");
      const data = Array.isArray(res.data?.requests) ? res.data.requests : [];
      setItems(data);
      writeCache("withdrawals", data);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to load withdrawals",
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
    return items.filter((w) => w.status === filter);
  }, [items, filter]);

  const openComplete = useCallback((w: WithdrawalRecord) => {
    setTxnId("");
    setNote("");
    setAmount(String(w.nprEquivalent ?? w.pointsRequested ?? ""));
    setCompleteTarget(w);
  }, []);

  const openReject = useCallback((w: WithdrawalRecord) => {
    setNote("");
    setRejectTarget(w);
  }, []);

  const setStatusLocal = useCallback((id: string, status: string) => {
    setItems((prev) => prev.map((w) => (w._id === id ? { ...w, status } : w)));
  }, []);

  const submitComplete = useCallback(async () => {
    if (!completeTarget) return;
    if (!txnId.trim() || !Number(amount)) {
      Toast.show({
        type: "error",
        text1: "eSewa Txn ID and amount are required",
        position: "bottom",
      });
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/mobile/admin/withdrawals/${completeTarget._id}/complete`, {
        transactionId: txnId.trim(),
        amountSent: Number(amount),
        adminNote: note.trim() || null,
      });
      setStatusLocal(completeTarget._id, "COMPLETED");
      Toast.show({ type: "success", text1: "Withdrawal completed", position: "bottom" });
      setCompleteTarget(null);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to complete",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setSubmitting(false);
    }
  }, [completeTarget, txnId, amount, note, setStatusLocal]);

  const submitReject = useCallback(async () => {
    if (!rejectTarget) return;
    setSubmitting(true);
    try {
      await api.post(`/mobile/admin/withdrawals/${rejectTarget._id}/reject`, {
        adminNote: note.trim() || null,
      });
      setStatusLocal(rejectTarget._id, "REJECTED");
      Toast.show({ type: "success", text1: "Withdrawal rejected", position: "bottom" });
      setRejectTarget(null);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to reject",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setSubmitting(false);
    }
  }, [rejectTarget, note, setStatusLocal]);

  const renderItem = useCallback(
    ({ item }: { item: WithdrawalRecord }) => {
      const statusMeta = STATUS_META[item.status] ?? {
        color: iconColor,
        bg: "rgba(120,120,120,0.12)",
      };
      const pending = item.status === "PENDING";

      return (
        <View className="mb-3 rounded-2xl border border-border bg-card p-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-[15px] font-semibold text-foreground">
                {item.teacherId?.name ?? "Unknown"}
              </Text>
              {item.teacherId?.email ? (
                <Text className="text-[12px] text-muted-foreground">
                  {item.teacherId.email}
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
            <Text className="text-[13px] text-muted-foreground">
              {item.pointsRequested} pts
            </Text>
            <Text className="text-[15px] font-bold text-foreground">
              NPR {item.nprEquivalent ?? item.pointsRequested}
            </Text>
          </View>

          {item.esewaNumber ? (
            <Text className="mt-1 text-[12px] text-muted-foreground">
              eSewa: {item.esewaNumber}
            </Text>
          ) : null}

          <View className="mt-1 flex-row items-center justify-between">
            <Text className="text-[11px] text-muted-foreground">
              {item.transactionId ? `Txn #${item.transactionId}` : ""}
            </Text>
            <Text className="text-[11px] text-muted-foreground">
              {formatDate(item.createdAt)}
            </Text>
          </View>

          {item.adminNote ? (
            <Text className="mt-2 text-[12px] italic text-muted-foreground">
              Note: {item.adminNote}
            </Text>
          ) : null}

          {pending ? (
            <View className="mt-3 flex-row gap-2">
              <TouchableOpacity
                onPress={() => openComplete(item)}
                activeOpacity={0.85}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full py-2.5"
                style={{ backgroundColor: "rgba(16,185,129,0.12)" }}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color="#10B981" />
                <Text className="text-[13px] font-semibold" style={{ color: "#10B981" }}>
                  Complete
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => openReject(item)}
                activeOpacity={0.85}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full py-2.5"
                style={{ backgroundColor: "rgba(239,68,68,0.12)" }}
              >
                <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
                <Text className="text-[13px] font-semibold" style={{ color: "#EF4444" }}>
                  Reject
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      );
    },
    [iconColor, openComplete, openReject],
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
              Withdrawals
            </Text>
            <Text className="text-[12px] text-muted-foreground">
              {filtered.length} shown
            </Text>
          </View>
        </View>

        <View className="mt-3 flex-row gap-2">
          {(["ALL", "PENDING", "COMPLETED", "REJECTED"] as StatusFilter[]).map((f) => {
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
              <Ionicons name="cash-outline" size={40} color="#9CA3AF" />
              <Text className="mt-3 text-[14px] text-muted-foreground">
                No withdrawal requests.
              </Text>
            </View>
          }
        />
      )}

      {/* Complete modal */}
      <Modal
        visible={!!completeTarget}
        transparent
        animationType="fade"
        onRequestClose={() => !submitting && setCompleteTarget(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 p-6">
          <View className="w-full rounded-3xl border border-border bg-card p-5">
            <Text className="text-[17px] font-bold text-foreground">
              Complete withdrawal
            </Text>
            <Text className="mt-1 text-[13px] text-muted-foreground">
              Enter the eSewa transaction ID and the amount you sent.
            </Text>

            <Text className="mb-1 ml-1 mt-3 text-[12px] font-medium text-foreground">
              eSewa Txn ID
            </Text>
            <TextInput
              value={txnId}
              onChangeText={setTxnId}
              placeholder="e.g. 0KAB1CD"
              placeholderTextColor="#6B7280"
              autoCapitalize="characters"
              className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
            />

            <Text className="mb-1 ml-1 mt-3 text-[12px] font-medium text-foreground">
              Amount sent (NPR)
            </Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor="#6B7280"
              keyboardType="numeric"
              className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
            />

            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Optional note"
              placeholderTextColor="#6B7280"
              multiline
              className="mt-3 min-h-[52px] rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
            />

            <View className="mt-4 flex-row gap-2">
              <TouchableOpacity
                onPress={() => !submitting && setCompleteTarget(null)}
                activeOpacity={0.85}
                className="flex-1 items-center rounded-full border border-border py-3"
              >
                <Text className="text-[14px] font-semibold text-foreground">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitComplete}
                disabled={submitting}
                activeOpacity={0.85}
                className="flex-1 items-center rounded-full py-3"
                style={{ backgroundColor: "#10B981" }}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-[14px] font-semibold text-white">Complete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reject modal */}
      <Modal
        visible={!!rejectTarget}
        transparent
        animationType="fade"
        onRequestClose={() => !submitting && setRejectTarget(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 p-6">
          <View className="w-full rounded-3xl border border-border bg-card p-5">
            <Text className="text-[17px] font-bold text-foreground">
              Reject withdrawal
            </Text>
            <Text className="mt-1 text-[13px] text-muted-foreground">
              Reserved points (if any) are refunded. The reason is sent to the teacher.
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Reason (optional)"
              placeholderTextColor="#6B7280"
              multiline
              className="mt-3 min-h-[64px] rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
            />
            <View className="mt-4 flex-row gap-2">
              <TouchableOpacity
                onPress={() => !submitting && setRejectTarget(null)}
                activeOpacity={0.85}
                className="flex-1 items-center rounded-full border border-border py-3"
              >
                <Text className="text-[14px] font-semibold text-foreground">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitReject}
                disabled={submitting}
                activeOpacity={0.85}
                className="flex-1 items-center rounded-full py-3"
                style={{ backgroundColor: "#EF4444" }}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-[14px] font-semibold text-white">Reject</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
