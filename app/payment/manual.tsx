import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";

export default function ManualPaymentScreen() {
  return (
    <View className="flex-1 bg-slate-950 px-4 pt-14">
      <TouchableOpacity onPress={() => router.back()} className="mb-6">
        <Text className="text-2xl text-white">←</Text>
      </TouchableOpacity>
      <Text className="mb-2 text-2xl font-bold text-white">Manual Payment</Text>
      <Text className="text-slate-400">Coming in Sprint 5</Text>
    </View>
  );
}
