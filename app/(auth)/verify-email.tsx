import { Image, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useAppTheme } from "@/hooks/use-app-theme";

export default function VerifyEmailScreen() {
  const { statusBarStyle, backgroundColor, iconColor } = useAppTheme();

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      <View className="mb-6 h-16 w-16 items-center justify-center rounded-3xl border border-border bg-card">
        <Image
          source={require("../../assets/images/logo.png")}
          style={{ width: 40, height: 40 }}
          resizeMode="contain"
        />
      </View>
      <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Ionicons name="mail-unread-outline" size={28} color={iconColor} />
      </View>
      <Text className="text-center text-[30px] font-bold tracking-tight text-foreground">
        Check your email
      </Text>
      <Text className="mt-3 max-w-xs text-center text-[15px] leading-6 text-muted-foreground">
        We&apos;ve sent a verification code to your inbox. Use it in the signup flow to finish creating your account.
      </Text>

      <TouchableOpacity
        onPress={() => router.replace("/(auth)/register")}
        className="mt-8 w-full max-w-[280px] items-center rounded-full bg-primary py-4 shadow-lg"
        activeOpacity={0.85}
      >
        <Text className="text-[16px] font-semibold text-primary-foreground">
          Back to signup
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.replace("/(auth)/login")}
        className="mt-3"
        activeOpacity={0.85}
      >
        <Text className="text-sm font-semibold text-foreground">Go to sign in</Text>
      </TouchableOpacity>
    </View>
  );
}
