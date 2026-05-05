import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import Toast from "react-native-toast-message";
import api from "@/lib/api";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!email.trim()) {
      Toast.show({ type: "error", text1: "Please enter your email" });
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? "Something went wrong. Please try again.";
      Toast.show({ type: "error", text1: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-slate-950"
    >
      <View className="flex-1 px-6 pt-16">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mb-8 w-10 h-10 items-center justify-center"
        >
          <Text className="text-white text-2xl">←</Text>
        </TouchableOpacity>

        {sent ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-5xl mb-6">📧</Text>
            <Text className="text-white text-2xl font-bold mb-3 text-center">
              Check your email
            </Text>
            <Text className="text-slate-400 text-base text-center leading-relaxed max-w-xs">
              We sent a password reset link to{"\n"}
              <Text className="text-blue-400">{email}</Text>
            </Text>
            <TouchableOpacity
              onPress={() => router.replace("/(auth)/login")}
              className="mt-8 bg-blue-500 rounded-2xl px-8 py-4"
            >
              <Text className="text-white font-semibold">Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <View className="w-12 h-12 bg-blue-500 rounded-2xl items-center justify-center mb-5">
              <Text className="text-white text-xl font-bold">Q</Text>
            </View>
            <Text className="text-white text-3xl font-bold mb-2">
              Forgot password?
            </Text>
            <Text className="text-slate-400 text-base mb-8 leading-relaxed">
              No worries. We'll send you reset instructions.
            </Text>

            <Text className="text-slate-400 text-sm font-medium mb-2">
              Email
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#475569"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 text-white text-base mb-6"
            />

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              className="bg-blue-500 rounded-2xl py-4 items-center"
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-lg font-semibold">
                  Send Reset Link
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
