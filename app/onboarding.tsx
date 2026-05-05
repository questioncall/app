import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";

export default function OnboardingScreen() {
  return (
    <View className="flex-1 bg-slate-950 px-4 pt-14">
      <TouchableOpacity onPress={() => router.back()} className="mb-6">
        <Text className="text-white text-2xl">←</Text>
      </TouchableOpacity>
      <Text className="text-white text-2xl font-bold mb-2">Onboarding Videos</Text>
      <Text className="text-slate-400">Coming in Sprint 2</Text>
    </View>
  );
}
