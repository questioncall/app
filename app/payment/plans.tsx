import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useAppSelector } from "@/hooks/redux";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePlatformConfig } from "@/hooks/use-platform-config";
import { api } from "@/lib/api";

interface SubscriptionInfo {
  subscriptionStatus: string;
  subscriptionEnd: string | null;
  pendingManualPayment: boolean;
  questionsAsked: number;
  questionsRemaining: number | null;
  maxQuestions: number;
  baseMaxQuestions: number;
  bonusQuestions: number;
  planSlug: string;
  referralCode: string | null;
}

export default function PlansScreen() {
  const user = useAppSelector((s) => s.user.data);
  const { config, isLoading: configLoading } = usePlatformConfig();
  const {
    statusBarStyle,
    backgroundColor,
    primaryColor,
    primarySoftColor,
    cardColor,
    borderColor,
    mutedIconColor,
  } = useAppTheme();

  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null);
  const [loadingSub, setLoadingSub] = useState(false);

  const currentPlan = subInfo?.planSlug ?? user?.planSlug ?? "free";
  const plans = config?.plans ?? [];

  const fetchSubscription = useCallback(async () => {
    setLoadingSub(true);
    try {
      const res = await api.get("/user/subscription");
      setSubInfo(res.data);
    } catch {}
    setLoadingSub(false);
  }, []);

  useEffect(() => {
    if (user?.role === "STUDENT") void fetchSubscription();
  }, [user?.role, fetchSubscription]);

  const isLoading = configLoading || loadingSub;

  const getPlanIcon = (slug: string): any => {
    if (slug === "go") return "flash-outline";
    if (slug === "plus") return "star-outline";
    if (slug === "pro") return "rocket-outline";
    if (slug === "max") return "diamond-outline";
    return "document-outline";
  };

  const handleSelectPlan = (planSlug: string) => {
    if (subInfo?.pendingManualPayment) {
      return;
    }
    router.push({
      pathname: "/payment/manual" as any,
      params: { planSlug },
    });
  };

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* Header */}
      <View className="flex-row items-center px-4 pb-2 pt-14">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color={primaryColor} />
        </TouchableOpacity>
        <Text className="flex-1 text-2xl font-bold text-foreground">
          Subscription Plans
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Current plan info */}
          {subInfo ? (
            <View
              className="rounded-2xl border p-4"
              style={{ backgroundColor: primarySoftColor, borderColor }}
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-foreground">
                  Current Plan
                </Text>
                <View
                  className="rounded-full px-2.5 py-0.5"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Text className="text-xs font-bold text-white">
                    {currentPlan.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text className="mt-2 text-xs text-muted-foreground">
                Questions: {subInfo.questionsAsked}/{subInfo.maxQuestions}
                {subInfo.bonusQuestions > 0 ? ` (+${subInfo.bonusQuestions} bonus)` : ""}
                {subInfo.subscriptionEnd
                  ? ` · Expires: ${new Date(subInfo.subscriptionEnd).toLocaleDateString()}`
                  : ""}
              </Text>
              {subInfo.subscriptionStatus === "TRIAL" ? (
                <Text className="mt-1 text-xs text-amber-500">
                  You&apos;re on a free trial. Upgrade to unlock more questions!
                </Text>
              ) : null}
              {subInfo.pendingManualPayment ? (
                <View className="mt-3 flex-row items-center gap-2 rounded-lg bg-amber-500/10 p-2.5">
                  <Ionicons name="time-outline" size={16} color="#f59e0b" />
                  <Text className="flex-1 text-xs text-amber-600">
                    You have a pending payment. Please wait for admin verification.
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Plan cards */}
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.slug;
            const isPending = subInfo?.pendingManualPayment ?? false;

            return (
              <View
                key={plan.slug}
                className="overflow-hidden rounded-2xl border"
                style={{
                  backgroundColor: isCurrent ? primarySoftColor : cardColor,
                  borderColor: isCurrent ? primaryColor : borderColor,
                }}
              >
                <View className="p-5">
                  <View className="flex-row items-center gap-3">
                    <View
                      className="h-10 w-10 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: isCurrent ? primaryColor : primarySoftColor,
                      }}
                    >
                      <Ionicons
                        name={getPlanIcon(plan.slug)}
                        size={20}
                        color={isCurrent ? "#fff" : primaryColor}
                      />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-lg font-bold text-foreground">
                          {plan.name}
                        </Text>
                        {isCurrent ? (
                          <View
                            className="rounded-full px-2 py-0.5"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <Text className="text-[10px] font-bold text-white">
                              CURRENT
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text className="text-sm text-muted-foreground">
                        {plan.maxQuestions} questions
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text
                        className="text-2xl font-bold"
                        style={{ color: primaryColor }}
                      >
                        NPR {plan.price}
                      </Text>
                    </View>
                  </View>

                  {/* Features */}
                  {plan.features?.length > 0 ? (
                    <View className="mt-4 gap-2">
                      {plan.features.map((feature, i) => (
                        <View key={i} className="flex-row items-center gap-2">
                          <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                          <Text className="flex-1 text-sm text-foreground">
                            {feature}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {/* CTA */}
                  {!isCurrent ? (
                    <TouchableOpacity
                      className="mt-4 items-center rounded-xl py-3"
                      style={{
                        backgroundColor: isPending ? `${primaryColor}40` : primaryColor,
                      }}
                      onPress={() => handleSelectPlan(plan.slug)}
                      disabled={isPending}
                    >
                      <Text className="font-semibold text-white">
                        {isPending ? "Payment Pending..." : `Upgrade to ${plan.name}`}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })}

          {plans.length === 0 ? (
            <View className="items-center py-20">
              <Ionicons name="pricetags-outline" size={48} color={mutedIconColor} />
              <Text className="mt-3 text-base text-muted-foreground">
                No plans available
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
