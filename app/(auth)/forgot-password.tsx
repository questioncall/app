import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAppTheme } from "@/hooks/use-app-theme";
import { AuthNotice } from "@/components/auth/auth-notice";
import api from "@/lib/api";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { statusBarStyle, iconColor } = useAppTheme();

  async function handleSubmit() {
    if (!email.trim()) {
      setFormError("Please enter your email.");
      return;
    }

    setLoading(true);
    setFormError(null);
    try {
      await api.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? "Something went wrong. Please try again.";
      setFormError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 px-6 pt-16">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mb-6 w-10 h-10 items-center justify-center bg-card border border-border rounded-full"
          >
            <Ionicons name="arrow-back" size={20} color={iconColor} />
          </TouchableOpacity>

          {sent ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-5xl mb-6">📧</Text>
              <Text className="text-foreground text-2xl font-bold mb-3 text-center tracking-tight">
                Check your email
              </Text>
              <Text className="text-muted-foreground text-base text-center leading-relaxed max-w-xs">
                We sent a password reset link to{"\n"}
                <Text className="text-foreground font-bold">{email}</Text>
              </Text>
              <TouchableOpacity
                onPress={() => router.replace("/(auth)/login")}
                className="mt-8 bg-primary rounded-full px-8 py-4 shadow-lg"
              >
                <Text className="text-primary-foreground font-semibold text-[16px]">Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Image 
                source={require("../../assets/images/logo.png")} 
                style={{ width: 64, height: 64, marginBottom: 16, borderRadius: 16 }} 
                resizeMode="contain"
              />
              <Text className="text-foreground text-[32px] font-bold mb-2 tracking-tight">
                Forgot password?
              </Text>
              <Text className="text-muted-foreground text-base mb-8 leading-relaxed">
                No worries. We{"'"}ll send you reset instructions.
              </Text>

              <Text className="text-foreground text-sm font-medium mb-2 ml-1">
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#6B7280"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                className="bg-card border border-border rounded-2xl px-5 py-4 text-foreground text-[15px] mb-6"
              />

              <AuthNotice tone="error" message={formError} />

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading}
                className="bg-primary rounded-full py-4 items-center shadow-lg"
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-primary-foreground text-[16px] font-semibold">
                    Send Reset Link
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
