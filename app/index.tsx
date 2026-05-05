import { useEffect } from "react";
import { View, Text, TouchableOpacity, StatusBar } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAppSelector } from "@/hooks/redux";

export default function LandingScreen() {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const isLoading = useAppSelector((s) => s.auth.isLoading);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/(tabs)/feed");
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading || isAuthenticated) return null;

  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={["#0F172A", "#1E3A5F", "#0F172A"]}
        className="flex-1"
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Top section — logo + tagline */}
        <View className="flex-1 items-center justify-center px-8">
          {/* Value props */}
          <View className="flex-row gap-6 mb-12">
            <ValueProp icon="⏱️" label="15-Min Answers" />
            <ValueProp icon="🎥" label="Live Calls" />
            <ValueProp icon="💰" label="Earn by Teaching" />
          </View>

          {/* Logo placeholder */}
          <View className="w-24 h-24 rounded-3xl bg-blue-500 items-center justify-center mb-6 shadow-2xl">
            <Text className="text-white text-4xl font-bold">Q</Text>
          </View>

          <Text className="text-white text-4xl font-bold mb-3 tracking-tight">
            QuestionCall
          </Text>
          <Text className="text-blue-200 text-lg text-center leading-relaxed max-w-xs">
            Get expert answers in 15 minutes
          </Text>
        </View>

        {/* Bottom CTAs */}
        <View className="px-6 pb-12 gap-4">
          <TouchableOpacity
            className="bg-blue-500 rounded-2xl py-4 items-center shadow-lg"
            activeOpacity={0.85}
            onPress={() => router.push("/(auth)/register")}
          >
            <Text className="text-white text-lg font-semibold">Sign Up</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="border border-blue-400 rounded-2xl py-4 items-center"
            activeOpacity={0.85}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text className="text-blue-300 text-lg font-semibold">Sign In</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

function ValueProp({ icon, label }: { icon: string; label: string }) {
  return (
    <View className="items-center gap-1">
      <Text className="text-2xl">{icon}</Text>
      <Text className="text-blue-200 text-xs font-medium">{label}</Text>
    </View>
  );
}
