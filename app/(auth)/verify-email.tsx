import { View, Text, TouchableOpacity, StatusBar } from "react-native";
import { router } from "expo-router";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function VerifyEmailScreen() {
  const { statusBarStyle } = useAppTheme();

  return (
    <View className="flex-1 bg-background px-6 pt-16 items-center justify-center">
      <StatusBar barStyle={statusBarStyle} />
      <Text className="text-6xl mb-6">✉️</Text>
      <Text className="text-foreground text-[32px] font-bold mb-3 text-center tracking-tight">
        Verify your email
      </Text>
      <Text className="text-muted-foreground text-base text-center leading-relaxed max-w-xs mb-8">
        We sent a verification link to your email address. Click the link to
        activate your account and then sign in.
      </Text>

      <TouchableOpacity
        onPress={() => router.replace("/(auth)/login")}
        className="bg-primary rounded-full px-8 py-4 mb-4 shadow-lg w-full items-center max-w-[280px]"
      >
        <Text className="text-primary-foreground font-semibold text-[16px]">Go to Sign In</Text>
      </TouchableOpacity>

      <Text className="text-muted-foreground text-sm text-center mt-2">
        Didn{"'"}t receive it? Check your spam folder.
      </Text>
    </View>
  );
}
