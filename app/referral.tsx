import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  Share,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Toast from "react-native-toast-message";

import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";

type ReferralEntry = {
  _id: string;
  refereeName: string;
  bonus: number;
  date: string;
  status: string;
};

type ReferralData = {
  referralCode: string | null;
  bonusQuestions: number;
  totalReferred: number;
  totalBonusEarned: number;
  referrals: ReferralEntry[];
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ReferralScreen() {
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

  const [data, setData] = useState<ReferralData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReferral = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const res = await api.get("/user/referral");
      setData(res.data as ReferralData);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to load referral info");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchReferral();
  }, [fetchReferral]);

  const handleShare = async () => {
    if (!data?.referralCode) return;
    try {
      await Share.share({
        message: `Join QuestionCall — the fastest way to get answers from expert teachers! 🎓\n\nUse my referral code: ${data.referralCode}\n\nDownload the app and sign up with my code to get bonus questions.`,
        title: "Join QuestionCall",
      });
    } catch {
      Toast.show({ type: "error", text1: "Could not open share dialog" });
    }
  };

  const handleCopyCode = () => {
    if (!data?.referralCode) return;
    Toast.show({
      type: "success",
      text1: "Your referral code",
      text2: data.referralCode,
    });
  };

  const renderReferralEntry = ({ item }: { item: ReferralEntry }) => (
    <View
      className="mb-2 flex-row items-center gap-3 rounded-xl p-3"
      style={{ backgroundColor: cardColor, borderWidth: 1, borderColor }}
    >
      <View
        className="h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: primarySoftColor }}
      >
        <Ionicons name="person-outline" size={16} color={primaryColor} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground">{item.refereeName}</Text>
        <Text className="text-[11px] text-muted-foreground">{formatDate(item.date)}</Text>
      </View>
      <View className="items-end">
        <View
          className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
          style={{ backgroundColor: "#10b98120" }}
        >
          <Ionicons name="add-circle-outline" size={12} color="#10b981" />
          <Text className="text-[11px] font-bold text-emerald-600">+{item.bonus} Q</Text>
        </View>
      </View>
    </View>
  );

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
            <Text className="text-lg font-bold text-foreground">Invite Friends</Text>
            <Text className="text-[11px] text-muted-foreground">
              Earn bonus questions for each referral
            </Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text className="mt-3 text-center text-base text-foreground">{error}</Text>
          <TouchableOpacity
            onPress={() => fetchReferral()}
            className="mt-4 rounded-full px-6 py-2.5"
            style={{ backgroundColor: primaryColor }}
          >
            <Text className="font-semibold text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data?.referrals ?? []}
          keyExtractor={(r) => r._id}
          renderItem={renderReferralEntry}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                void fetchReferral(true);
              }}
              tintColor={primaryColor}
            />
          }
          ListHeaderComponent={
            <View className="mb-6 gap-4">
              {/* Referral code card */}
              <View
                className="items-center gap-3 rounded-2xl p-5"
                style={{
                  backgroundColor: cardColor,
                  borderWidth: 2,
                  borderColor: `${primaryColor}40`,
                }}
              >
                <View
                  className="h-16 w-16 items-center justify-center rounded-full"
                  style={{ backgroundColor: primarySoftColor }}
                >
                  <Text className="text-3xl">🎁</Text>
                </View>
                <Text className="text-center text-base font-bold text-foreground">
                  Invite friends, earn bonus questions
                </Text>
                <Text className="text-center text-sm text-muted-foreground">
                  Share your referral code. When your friend signs up and gets verified,
                  you both earn bonus questions.
                </Text>

                {data?.referralCode ? (
                  <>
                    <TouchableOpacity
                      onPress={handleCopyCode}
                      className="w-full items-center rounded-xl border-2 px-6 py-3"
                      style={{ borderColor: primaryColor, borderStyle: "dashed" }}
                    >
                      <Text className="mb-1 text-[11px] text-muted-foreground">
                        Your referral code
                      </Text>
                      <Text
                        className="text-2xl font-black tracking-widest"
                        style={{ color: primaryColor }}
                      >
                        {data.referralCode}
                      </Text>
                      <Text className="mt-1 text-[10px] text-muted-foreground">
                        Tap to see code
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleShare}
                      className="w-full flex-row items-center justify-center gap-2 rounded-full py-3"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Ionicons name="share-social-outline" size={18} color="#fff" />
                      <Text className="text-base font-semibold text-white">
                        Share Invite
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View className="w-full rounded-xl bg-amber-500/10 px-4 py-3">
                    <Text className="text-center text-sm text-amber-700 dark:text-amber-400">
                      Your referral code is being generated. Check back soon.
                    </Text>
                  </View>
                )}
              </View>

              {/* Stats row */}
              <View className="flex-row gap-3">
                <View
                  className="flex-1 items-center rounded-xl p-4"
                  style={{ backgroundColor: cardColor, borderWidth: 1, borderColor }}
                >
                  <Text className="text-2xl font-black" style={{ color: primaryColor }}>
                    {data?.totalReferred ?? 0}
                  </Text>
                  <Text className="mt-0.5 text-center text-[11px] text-muted-foreground">
                    Friends Referred
                  </Text>
                </View>
                <View
                  className="flex-1 items-center rounded-xl p-4"
                  style={{ backgroundColor: cardColor, borderWidth: 1, borderColor }}
                >
                  <Text className="text-2xl font-black text-emerald-600">
                    +{data?.totalBonusEarned ?? 0}
                  </Text>
                  <Text className="mt-0.5 text-center text-[11px] text-muted-foreground">
                    Bonus Questions
                  </Text>
                </View>
                <View
                  className="flex-1 items-center rounded-xl p-4"
                  style={{ backgroundColor: cardColor, borderWidth: 1, borderColor }}
                >
                  <Text className="text-2xl font-black" style={{ color: primaryColor }}>
                    {data?.bonusQuestions ?? 0}
                  </Text>
                  <Text className="mt-0.5 text-center text-[11px] text-muted-foreground">
                    Available Now
                  </Text>
                </View>
              </View>

              {(data?.referrals?.length ?? 0) > 0 && (
                <Text className="mt-2 text-sm font-semibold text-foreground">
                  Referred Friends ({data?.totalReferred})
                </Text>
              )}
            </View>
          }
          ListEmptyComponent={
            <View className="items-center py-8">
              <Text className="mb-3 text-3xl">👥</Text>
              <Text className="text-center text-base font-semibold text-foreground">
                No referrals yet
              </Text>
              <Text className="mt-1 px-4 text-center text-sm text-muted-foreground">
                Share your referral code with friends to earn bonus questions when they
                join.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
