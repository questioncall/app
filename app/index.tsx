import { useEffect } from "react";
import { View, Text, TouchableOpacity, StatusBar, Image } from "react-native";
import { router } from "expo-router";
import { useAppSelector } from "@/hooks/redux";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function LandingScreen() {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const isLoading = useAppSelector((s) => s.auth.isLoading);
  const { statusBarStyle, iconColor } = useAppTheme();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/(tabs)/feed");
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading || isAuthenticated) return null;

  return (
    <View className="flex-1 justify-between bg-background px-6 pb-10 pt-20">
      <StatusBar barStyle={statusBarStyle} />

      <View className="items-center pt-10">
        <View className="mb-5 rounded-2xl border border-border bg-card px-4 py-2">
          <Text className="text-xs font-semibold uppercase tracking-[0px] text-muted-foreground">
            QuestionCall
          </Text>
        </View>

        <Image
          source={require("../assets/images/logo.png")}
          style={{ width: 72, height: 72, marginBottom: 18, borderRadius: 18 }}
          resizeMode="contain"
        />
        <Text className="text-center text-[42px] font-bold tracking-tight text-foreground">
          Ask. Answer. Grow.
        </Text>
        <Text className="mt-3 max-w-sm text-center text-[15px] leading-6 text-muted-foreground">
          Students post academic questions, teachers accept them live, and the
          private answer room opens without friction.
        </Text>

        <View className="mt-6 flex-row flex-wrap justify-center gap-2">
          <View className="rounded-full border border-border bg-card px-4 py-2">
            <Text className="text-xs font-semibold text-foreground">Student signup</Text>
          </View>
          <View className="rounded-full border border-border bg-card px-4 py-2">
            <Text className="text-xs font-semibold text-foreground">Teacher signup</Text>
          </View>
          <View className="rounded-full border border-border bg-card px-4 py-2">
            <Text className="text-xs font-semibold text-foreground">Google sign-in</Text>
          </View>
        </View>
      </View>

      <View className="gap-3">
        <TouchableOpacity
          className="flex-row items-center justify-center gap-2 rounded-full bg-primary py-4 shadow-lg"
          activeOpacity={0.85}
          onPress={() => router.push("/(auth)/login")}
        >
          <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
          <Text className="text-[16px] font-semibold text-primary-foreground">
            Sign in with Email
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-row items-center justify-center gap-2 rounded-full border border-border bg-card py-4 shadow-sm"
          activeOpacity={0.85}
          onPress={() => router.push("/(auth)/login")}
        >
          <Ionicons name="logo-google" size={19} color={iconColor} />
          <Text className="text-[16px] font-semibold text-card-foreground">
            Continue with Google
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="items-center justify-center py-2"
          activeOpacity={0.85}
          onPress={() => router.push("/(auth)/register")}
        >
          <Text className="text-[15px] font-semibold text-foreground">
            Create account
          </Text>
        </TouchableOpacity>

        <Text className="px-4 pt-4 text-center text-[12px] leading-5 text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </View>
  );
}
