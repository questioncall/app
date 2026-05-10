import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  FlatList,
  RefreshControl,
  Share,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Toast from "react-native-toast-message";

import { api } from "@/lib/api";
import { useAppSelector } from "@/hooks/redux";
import { useAppTheme } from "@/hooks/use-app-theme";

interface ReferralEntry {
  _id: string;
  refereeName: string;
  bonus: number;
  date: string;
  status: string;
}

interface ReferralStats {
  referralCode: string | null;
  bonusQuestions: number;
  totalReferred: number;
  totalBonusEarned: number;
  referrals: ReferralEntry[];
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string | number;
  color: string;
}) {
  const { cardColor, borderColor } = useAppTheme();
  return (
    <View
      className="flex-1 items-center rounded-2xl border p-4"
      style={{ backgroundColor: cardColor, borderColor }}
    >
      <View
        className="mb-2 h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${color}18` }}
      >
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text className="text-xl font-bold text-foreground">{value}</Text>
      <Text className="mt-0.5 text-center text-[11px] text-muted-foreground">
        {label}
      </Text>
    </View>
  );
}

export default function ReferralScreen() {
  const {
    statusBarStyle,
    backgroundColor,
    primaryColor,
    cardColor,
    borderColor,
    mutedIconColor,
  } = useAppTheme();
  const user = useAppSelector((s) => s.user.data);

  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [sending, setSending] = useState(false);

  const referralLink = `https://questioncall.com/register?ref=${stats?.referralCode ?? user?.referralCode ?? ""}`;

  const fetchStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get("/user/referral");
      setStats(res.data);
    } catch {
      // show whatever we have
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  function copyCode() {
    const code = stats?.referralCode ?? user?.referralCode ?? "";
    if (!code) return;
    Clipboard.setString(code);
    Toast.show({ type: "success", text1: "Referral code copied!" });
  }

  async function shareLink() {
    try {
      await Share.share({
        message: `Join QuestionCall and get bonus questions! Use my referral code: ${stats?.referralCode ?? user?.referralCode ?? ""}\n\n${referralLink}`,
        url: referralLink,
      });
    } catch {
      // dismissed
    }
  }

  async function sendInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Toast.show({ type: "error", text1: "Enter a valid email address." });
      return;
    }
    setSending(true);
    try {
      await api.post("/referral/invite", {
        emails: [email],
        referralLink,
      });
      setInviteEmail("");
      Toast.show({ type: "success", text1: `Invitation sent to ${email}!` });
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1: err?.response?.data?.error ?? "Failed to send invite.",
      });
    } finally {
      setSending(false);
    }
  }

  const code = stats?.referralCode ?? user?.referralCode ?? "—";

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
        <Text className="flex-1 text-2xl font-bold text-foreground">Referrals</Text>
        <Ionicons name="gift" size={22} color={primaryColor} />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <FlatList
          data={stats?.referrals ?? []}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchStats(true)}
              tintColor={primaryColor}
            />
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          ListHeaderComponent={
            <>
              {/* Referral code card */}
              <View
                className="mb-5 mt-2 overflow-hidden rounded-3xl border"
                style={{ backgroundColor: cardColor, borderColor }}
              >
                <View className="items-center px-6 py-7">
                  <View
                    className="mb-3 h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: `${primaryColor}18` }}
                  >
                    <Ionicons name="gift-outline" size={28} color={primaryColor} />
                  </View>
                  <Text className="mb-1 text-sm text-muted-foreground">
                    Your referral code
                  </Text>
                  <View className="flex-row items-center gap-3">
                    <Text className="text-3xl font-bold tracking-[6px] text-foreground">
                      {code}
                    </Text>
                    <TouchableOpacity
                      onPress={copyCode}
                      className="h-9 w-9 items-center justify-center rounded-xl bg-secondary"
                      activeOpacity={0.7}
                    >
                      <Ionicons name="copy-outline" size={17} color={primaryColor} />
                    </TouchableOpacity>
                  </View>
                  <Text className="mt-2 text-center text-xs leading-4 text-muted-foreground">
                    Friends who sign up with your code get bonus questions, and so do you!
                  </Text>
                  <TouchableOpacity
                    onPress={shareLink}
                    className="mt-5 w-full flex-row items-center justify-center gap-2 rounded-full py-3.5"
                    style={{ backgroundColor: primaryColor }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="share-social-outline" size={18} color="#FFF" />
                    <Text className="font-bold text-white">Share Invite Link</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Stats row */}
              <View className="mb-5 flex-row gap-3">
                <StatCard
                  icon="people-outline"
                  label="Friends Joined"
                  value={stats?.totalReferred ?? 0}
                  color={primaryColor}
                />
                <StatCard
                  icon="help-circle-outline"
                  label="Bonus Questions"
                  value={stats?.totalBonusEarned ?? 0}
                  color="#10B981"
                />
                <StatCard
                  icon="checkmark-circle-outline"
                  label="Active Bonus"
                  value={stats?.bonusQuestions ?? 0}
                  color="#F59E0B"
                />
              </View>

              {/* Invite by email */}
              <View
                className="mb-5 rounded-2xl border p-4"
                style={{ backgroundColor: cardColor, borderColor }}
              >
                <Text className="mb-3 text-sm font-semibold text-foreground">
                  Invite by email
                </Text>
                <View className="flex-row gap-2">
                  <TextInput
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                    placeholder="friend@email.com"
                    placeholderTextColor={mutedIconColor}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className="flex-1 rounded-xl border px-4 py-3 text-sm text-foreground"
                    style={{ borderColor, backgroundColor }}
                  />
                  <TouchableOpacity
                    onPress={sendInvite}
                    disabled={sending}
                    className="items-center justify-center rounded-xl px-4"
                    style={{ backgroundColor: primaryColor }}
                    activeOpacity={0.85}
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Ionicons name="send" size={18} color="#FFF" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {(stats?.referrals?.length ?? 0) > 0 ? (
                <Text className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Joined via your code
                </Text>
              ) : null}
            </>
          }
          renderItem={({ item }) => (
            <View
              className="mb-2.5 flex-row items-center rounded-2xl border px-4 py-3"
              style={{ backgroundColor: cardColor, borderColor }}
            >
              <View
                className="mr-3 h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: `${primaryColor}18` }}
              >
                <Text className="text-sm font-bold" style={{ color: primaryColor }}>
                  {item.refereeName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">
                  {item.refereeName}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {new Date(item.date).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-sm font-bold text-emerald-500">+{item.bonus}</Text>
                <Text className="text-[10px] text-muted-foreground">bonus Qs</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            stats && stats.referrals.length === 0 ? (
              <View className="mt-4 items-center py-8">
                <Ionicons name="people-outline" size={40} color={mutedIconColor} />
                <Text className="mt-2 text-sm text-muted-foreground">
                  No one has joined yet — share your code!
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}
