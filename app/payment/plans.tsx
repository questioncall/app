import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useAppSelector } from "@/hooks/redux";

export default function PlansScreen() {
  const user = useAppSelector((s) => s.user.data);
  const config = useAppSelector((s) => s.config.data);
  const currentPlan = user?.planSlug ?? "free";
  const plans = config?.plans ?? [];

  return (
    <View className="flex-1 bg-slate-950">
      <View className="px-4 pt-14 pb-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Text className="text-white text-2xl">←</Text>
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">Subscription Plans</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {plans.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-slate-400">Loading plans...</Text>
          </View>
        ) : (
          plans.map((plan) => (
            <View
              key={plan.slug}
              className={`rounded-2xl p-5 border ${
                currentPlan === plan.slug
                  ? "bg-blue-900 border-blue-500"
                  : "bg-slate-900 border-slate-800"
              }`}
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-white text-lg font-bold">{plan.name}</Text>
                {currentPlan === plan.slug ? (
                  <View className="bg-blue-500 rounded-full px-3 py-1">
                    <Text className="text-white text-xs font-bold">Current</Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-blue-300 text-2xl font-bold mb-1">
                NPR {plan.price.toLocaleString()}
                <Text className="text-sm text-slate-400">/mo</Text>
              </Text>
              <Text className="text-slate-400 text-sm mb-3">
                {plan.maxQuestions} questions/month
              </Text>
              {currentPlan !== plan.slug ? (
                <TouchableOpacity
                  className="bg-blue-500 rounded-xl py-3 items-center"
                  onPress={() => router.push("/payment/manual" as any)}
                >
                  <Text className="text-white font-semibold">
                    Upgrade to {plan.name}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
