import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";

export default function VerifyEmailScreen() {
  return (
    <View className="flex-1 bg-slate-950 px-6 pt-16 items-center justify-center">
      <Text className="text-6xl mb-6">✉️</Text>
      <Text className="text-white text-2xl font-bold mb-3 text-center">
        Verify your email
      </Text>
      <Text className="text-slate-400 text-base text-center leading-relaxed max-w-xs mb-8">
        We sent a verification link to your email address. Click the link to
        activate your account and then sign in.
      </Text>

      <TouchableOpacity
        onPress={() => router.replace("/(auth)/login")}
        className="bg-blue-500 rounded-2xl px-8 py-4 mb-4"
      >
        <Text className="text-white font-semibold text-base">Go to Sign In</Text>
      </TouchableOpacity>

      <Text className="text-slate-500 text-sm text-center">
        Didn't receive it? Check your spam folder.
      </Text>
    </View>
  );
}
