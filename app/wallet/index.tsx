import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { StatusBarStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { usePreventScreenCapture } from "expo-screen-capture";

import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useBiometricGate } from "@/hooks/use-biometric-gate";
import { api } from "@/lib/api";
import {
  setWalletData,
  setWalletError,
  setWalletLoading,
  selectIsWalletStale,
  type WalletData,
  type WithdrawalHistoryItem,
  type EarningHistoryItem,
} from "@/store/slices/walletSlice";

type HistoryTab = "withdrawals" | "earnings" | "payouts";

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "COMPLETED" ? "#22c55e" : status === "PENDING" ? "#f59e0b" : "#ef4444";
  const bg =
    status === "COMPLETED"
      ? "rgba(34,197,94,0.12)"
      : status === "PENDING"
        ? "rgba(245,158,11,0.12)"
        : "rgba(239,68,68,0.12)";

  return (
    <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: bg }}>
      <Text className="text-xs font-semibold" style={{ color }}>
        {status}
      </Text>
    </View>
  );
}

export default function WalletScreen() {
  usePreventScreenCapture();
  const { isUnlocked, isPending, biometricType, authenticate, handleGoBack } =
    useBiometricGate();
  const dispatch = useAppDispatch();
  const wallet = useAppSelector((s) => s.wallet);
  const user = useAppSelector((s) => s.user.data);
  const {
    statusBarStyle,
    backgroundColor,
    primaryColor,
    primarySoftColor,
    cardColor,
    borderColor,
    mutedIconColor,
  } = useAppTheme();

  const isTeacher = user?.role === "TEACHER";
  const [activeTab, setActiveTab] = useState<HistoryTab>("withdrawals");
  const [refreshing, setRefreshing] = useState(false);

  const fetchWallet = useCallback(
    async (silent = false) => {
      if (!silent) dispatch(setWalletLoading(true));
      try {
        const res = await api.get("/wallet", { params: { limit: 50, skip: 0 } });
        dispatch(setWalletData(res.data as WalletData));
      } catch (err: any) {
        dispatch(setWalletError(err?.response?.data?.error ?? "Failed to load wallet"));
      }
    },
    [dispatch],
  );

  useEffect(() => {
    if (!isUnlocked) return;
    if (selectIsWalletStale(wallet.lastFetchedAt)) {
      void fetchWallet();
    }
  }, [isUnlocked, wallet.lastFetchedAt, fetchWallet]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchWallet(true);
    setRefreshing(false);
  }, [fetchWallet]);

  const data = wallet.data;

  const tabs: { key: HistoryTab; label: string }[] = useMemo(
    () =>
      isTeacher
        ? [
            { key: "withdrawals", label: "Withdrawals" },
            { key: "earnings", label: "Earnings" },
            { key: "payouts", label: "Payouts" },
          ]
        : [{ key: "withdrawals", label: "Withdrawals" }],
    [isTeacher],
  );

  const activeList = useMemo(() => {
    if (!data) return [];
    if (activeTab === "withdrawals") return data.withdrawalHistory ?? [];
    if (activeTab === "earnings") return data.earningHistory ?? [];
    return data.questionPayoutHistory ?? [];
  }, [data, activeTab]);

  if (!isUnlocked) {
    return (
      <BiometricLockScreen
        statusBarStyle={statusBarStyle}
        backgroundColor={backgroundColor}
        primaryColor={primaryColor}
        primarySoftColor={primarySoftColor}
        mutedIconColor={mutedIconColor}
        biometricType={biometricType}
        isPending={isPending}
        onAuthenticate={authenticate}
        onGoBack={handleGoBack}
      />
    );
  }

  if (wallet.isLoading && !data) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  if (wallet.error && !data) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text className="mt-3 text-center text-base text-foreground">{wallet.error}</Text>
        <TouchableOpacity
          onPress={() => void fetchWallet()}
          className="mt-4 rounded-full px-6 py-2.5"
          style={{ backgroundColor: primaryColor }}
        >
          <Text className="font-semibold text-white">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pointBalance = data?.pointBalance ?? 0;
  const nprEquivalent = data?.nprEquivalent ?? 0;

  const renderWithdrawalItem = ({ item }: { item: WithdrawalHistoryItem }) => (
    <View
      className="mx-4 mb-3 rounded-2xl border p-4"
      style={{ backgroundColor: cardColor, borderColor }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-foreground">
          {item.pointsRequested.toLocaleString()} pts
        </Text>
        <StatusBadge status={item.status} />
      </View>
      <Text className="mt-1 text-sm text-muted-foreground">
        NPR {item.nprEquivalent.toLocaleString()} · eSewa: {item.esewaNumber}
      </Text>
      <Text className="mt-1 text-xs text-muted-foreground">
        {formatDate(item.createdAt)}
        {item.processedAt ? ` · Processed ${formatDate(item.processedAt)}` : ""}
      </Text>
      {item.adminNote ? (
        <Text className="mt-2 text-xs italic text-muted-foreground">
          Note: {item.adminNote}
        </Text>
      ) : null}
    </View>
  );

  const renderEarningItem = ({ item }: { item: EarningHistoryItem }) => {
    const isPositive = item.pointsDelta >= 0;
    return (
      <View
        className="mx-4 mb-3 rounded-2xl border p-4"
        style={{ backgroundColor: cardColor, borderColor }}
      >
        <View className="flex-row items-center justify-between">
          <View className="mr-3 flex-1">
            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
              {item.title}
            </Text>
            {item.description ? (
              <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
          </View>
          <Text
            className="text-base font-bold"
            style={{ color: isPositive ? "#22c55e" : "#ef4444" }}
          >
            {isPositive ? "+" : ""}
            {item.pointsDelta.toLocaleString()} pts
          </Text>
        </View>
        <Text className="mt-1 text-xs text-muted-foreground">
          {formatDate(item.occurredAt)}
          {item.nprAmount != null ? ` · NPR ${item.nprAmount.toLocaleString()}` : ""}
        </Text>
      </View>
    );
  };

  const renderPayoutItem = ({ item }: { item: any }) => (
    <View
      className="mx-4 mb-3 rounded-2xl border p-4"
      style={{ backgroundColor: cardColor, borderColor }}
    >
      <View className="flex-row items-center justify-between">
        <View className="mr-3 flex-1">
          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
            {item.questionTitle ?? "Question Answer"}
          </Text>
          {item.rating != null ? (
            <Text className="mt-0.5 text-xs text-muted-foreground">
              Rating: {"★".repeat(item.rating)}
              {"☆".repeat(5 - item.rating)}
            </Text>
          ) : null}
        </View>
        <Text
          className="text-base font-bold"
          style={{ color: item.finalPoints >= 0 ? "#22c55e" : "#ef4444" }}
        >
          {item.finalPoints >= 0 ? "+" : ""}
          {item.finalPoints.toLocaleString()} pts
        </Text>
      </View>
      <View className="mt-2 flex-row flex-wrap gap-2">
        {item.ratingPoints > 0 ? (
          <Text className="text-xs text-muted-foreground">
            Base: +{item.ratingPoints}
          </Text>
        ) : null}
        {item.bonusPoints > 0 ? (
          <Text className="text-xs text-emerald-500">Bonus: +{item.bonusPoints}</Text>
        ) : null}
        {item.commissionPoints > 0 ? (
          <Text className="text-xs text-amber-500">
            Commission: -{item.commissionPoints} ({item.commissionPercent}%)
          </Text>
        ) : null}
        {item.penaltyPoints > 0 ? (
          <Text className="text-xs text-red-500">Penalty: -{item.penaltyPoints}</Text>
        ) : null}
      </View>
      <Text className="mt-1 text-xs text-muted-foreground">
        {formatDate(item.occurredAt)}
      </Text>
    </View>
  );

  const renderItem = ({ item }: { item: any }) => {
    if (activeTab === "withdrawals") return renderWithdrawalItem({ item });
    if (activeTab === "earnings") return renderEarningItem({ item });
    return renderPayoutItem({ item });
  };

  const headerComponent = (
    <>
      {/* Balance card */}
      <View
        className="mx-4 mt-4 rounded-2xl p-5"
        style={{ backgroundColor: primarySoftColor }}
      >
        <Text className="text-xs text-muted-foreground">
          {isTeacher ? "Point Balance" : "Quiz Points"}
        </Text>
        <Text className="mt-1 text-4xl font-bold text-foreground">
          {pointBalance.toLocaleString()}
          <Text className="text-lg font-normal text-muted-foreground"> pts</Text>
        </Text>
        <Text className="mt-1 text-base text-muted-foreground">
          ≈ NPR {nprEquivalent.toLocaleString()}
        </Text>

        {/* Stats row */}
        <View className="mt-4 flex-row gap-3">
          <View className="flex-1 rounded-xl border border-border bg-card p-3">
            <Text className="text-xs text-muted-foreground">Total Earned</Text>
            <Text className="mt-0.5 text-base font-bold text-foreground">
              {(data?.totalPointsEarned ?? 0).toLocaleString()}
            </Text>
          </View>
          <View className="flex-1 rounded-xl border border-border bg-card p-3">
            <Text className="text-xs text-muted-foreground">Withdrawn</Text>
            <Text className="mt-0.5 text-base font-bold text-foreground">
              {(data?.totalPointsWithdrawn ?? 0).toLocaleString()}
            </Text>
          </View>
          {data?.pendingWithdrawal ? (
            <View className="flex-1 rounded-xl border border-amber-500/30 bg-card p-3">
              <Text className="text-xs text-amber-500">Pending</Text>
              <Text className="mt-0.5 text-base font-bold text-amber-500">
                {data.pendingWithdrawal.toLocaleString()}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Action buttons */}
      <View className="mx-4 mt-4 flex-row gap-3">
        {isTeacher ? (
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-3.5"
            style={{ backgroundColor: primaryColor }}
            onPress={() => router.push("/wallet/withdraw" as any)}
          >
            <Ionicons name="cash-outline" size={18} color="#fff" />
            <Text className="font-semibold text-white">Withdraw</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border py-3.5"
          style={{ borderColor }}
          onPress={() => router.push("/payment/plans" as any)}
        >
          <Ionicons name="diamond-outline" size={18} color={primaryColor} />
          <Text className="font-semibold" style={{ color: primaryColor }}>
            Plans
          </Text>
        </TouchableOpacity>
      </View>

      {/* Subscription info (students) */}
      {!isTeacher && data?.subscriptionStatus ? (
        <View
          className="mx-4 mt-4 rounded-2xl border p-4"
          style={{ backgroundColor: cardColor, borderColor }}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-foreground">Subscription</Text>
            <StatusBadge status={data.subscriptionStatus} />
          </View>
          <Text className="mt-1 text-xs text-muted-foreground">
            Plan: {user?.planSlug ?? "free"} · Questions: {data.questionsAsked}/
            {data.maxQuestions}
            {data.subscriptionEnd
              ? ` · Expires: ${formatDate(data.subscriptionEnd)}`
              : ""}
          </Text>
        </View>
      ) : null}

      {/* Teacher monetization info */}
      {isTeacher ? (
        <View
          className="mx-4 mt-4 rounded-2xl border p-4"
          style={{ backgroundColor: cardColor, borderColor }}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-foreground">Teacher Stats</Text>
            <View className="flex-row items-center gap-1">
              <Ionicons name="star" size={14} color="#f59e0b" />
              <Text className="text-sm font-bold text-foreground">
                {data?.overallScore ?? "—"}
              </Text>
            </View>
          </View>
          <Text className="mt-1 text-xs text-muted-foreground">
            Answered: {data?.totalAnswered ?? 0} · Monetized:{" "}
            {data?.isMonetized ? "Yes" : "No"} · Rate: 1 pt = NPR{" "}
            {data?.pointToNprRate ?? 1}
          </Text>
          {data?.totalPenaltyPoints ? (
            <Text className="mt-1 text-xs text-red-500">
              Penalties: -{data.totalPenaltyPoints.toLocaleString()} pts
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* History tabs */}
      <View className="mx-4 mt-5 flex-row gap-2">
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className="rounded-full px-4 py-2"
            style={{
              backgroundColor: activeTab === tab.key ? primaryColor : "transparent",
              borderWidth: activeTab === tab.key ? 0 : 1,
              borderColor,
            }}
          >
            <Text
              className="text-sm font-medium"
              style={{
                color: activeTab === tab.key ? "#fff" : mutedIconColor,
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeList.length === 0 ? (
        <View className="items-center py-12">
          <Ionicons name="receipt-outline" size={40} color={mutedIconColor} />
          <Text className="mt-3 text-sm text-muted-foreground">
            No {activeTab} history yet
          </Text>
        </View>
      ) : null}
    </>
  );

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* Header */}
      <View className="flex-row items-center px-4 pb-2 pt-14">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color={primaryColor} />
        </TouchableOpacity>
        <Text className="flex-1 text-2xl font-bold text-foreground">Wallet</Text>
        <TouchableOpacity onPress={() => void fetchWallet(true)}>
          <Ionicons name="refresh-outline" size={22} color={mutedIconColor} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={activeList.length > 0 ? activeList : []}
        keyExtractor={(item: any, idx) => item._id ?? item.id ?? `${activeTab}-${idx}`}
        renderItem={renderItem}
        ListHeaderComponent={headerComponent}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </View>
  );
}

interface LockScreenProps {
  statusBarStyle: StatusBarStyle;
  backgroundColor: string;
  primaryColor: string;
  primarySoftColor: string;
  mutedIconColor: string;
  biometricType: "fingerprint" | "face" | "passcode";
  isPending: boolean;
  onAuthenticate: () => Promise<boolean>;
  onGoBack: () => void;
}

function BiometricLockScreen({
  statusBarStyle,
  backgroundColor,
  primaryColor,
  primarySoftColor,
  mutedIconColor,
  biometricType,
  isPending,
  onAuthenticate,
  onGoBack,
}: LockScreenProps) {
  const icon =
    biometricType === "face"
      ? "scan-outline"
      : biometricType === "fingerprint"
        ? "finger-print-outline"
        : "keypad-outline";

  const label =
    biometricType === "face"
      ? "Face ID"
      : biometricType === "fingerprint"
        ? "Fingerprint"
        : "Passcode";

  return (
    <View className="flex-1 items-center justify-center bg-background px-8">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
      <View
        className="mb-6 h-24 w-24 items-center justify-center rounded-full"
        style={{ backgroundColor: primarySoftColor }}
      >
        <Ionicons name="wallet-outline" size={40} color={primaryColor} />
      </View>
      <Text className="mb-2 text-center text-2xl font-bold text-foreground">
        Wallet Locked
      </Text>
      <Text className="mb-8 text-center text-sm text-muted-foreground">
        Verify your identity to view your balance and transactions.
      </Text>
      <TouchableOpacity
        onPress={() => void onAuthenticate()}
        disabled={isPending}
        className="mb-4 items-center justify-center rounded-full px-10 py-4"
        style={{ backgroundColor: primaryColor }}
        activeOpacity={0.85}
      >
        <View className="flex-row items-center gap-2">
          {isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name={icon as any} size={22} color="#fff" />
          )}
          <Text className="text-base font-bold text-white">
            {isPending ? "Authenticating…" : `Use ${label}`}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={onGoBack} className="mt-2 px-4 py-3">
        <Text className="text-sm font-medium" style={{ color: mutedIconColor }}>
          Go Back
        </Text>
      </TouchableOpacity>
    </View>
  );
}
