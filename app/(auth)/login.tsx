import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import Toast from "react-native-toast-message";
import { useAppDispatch } from "@/hooks/redux";
import { setTokens } from "@/store/slices/authSlice";
import { setUser } from "@/store/slices/userSlice";
import { SECURE_STORE_KEYS } from "@/lib/api";
import api from "@/lib/api";

export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Toast.show({ type: "error", text1: "Please fill in all fields" });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/mobile/login", { email, password });
      const { accessToken, refreshToken, user } = res.data;

      await SecureStore.setItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN, accessToken);
      await SecureStore.setItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN, refreshToken);

      dispatch(setTokens({ accessToken, refreshToken }));
      // Login response returns: { id, name, email, role, isSuspended }
      if (user) {
        dispatch(
          setUser({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            isSuspended: user.isSuspended,
            // defaults until full user data is fetched
            points: 0,
            pointBalance: 0,
            subscriptionStatus: "INACTIVE",
            planSlug: "free",
            questionsAsked: 0,
            bonusQuestions: 0,
            maxQuestions: 0,
            isMonetized: false,
            teacherModeVerified: false,
            dailyAnswersCount: 0,
            dailyTargetsAchieved: [],
            seenOnboardingRoles: [],
          })
        );
      }

      router.replace("/(tabs)/feed");
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? "Login failed. Please try again.";
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
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="px-6 pt-16 pb-8">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mb-8 w-10 h-10 items-center justify-center"
          >
            <Text className="text-white text-2xl">←</Text>
          </TouchableOpacity>

          <View className="w-12 h-12 bg-blue-500 rounded-2xl items-center justify-center mb-5">
            <Text className="text-white text-xl font-bold">Q</Text>
          </View>
          <Text className="text-white text-3xl font-bold mb-2">
            Welcome back
          </Text>
          <Text className="text-slate-400 text-base">
            Sign in to your QuestionCall account
          </Text>
        </View>

        {/* Form */}
        <View className="px-6 gap-4">
          <View>
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
              className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 text-white text-base"
            />
          </View>

          <View>
            <Text className="text-slate-400 text-sm font-medium mb-2">
              Password
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor="#475569"
              secureTextEntry
              autoComplete="password"
              className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 text-white text-base"
            />
          </View>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/forgot-password")}
            className="self-end"
          >
            <Text className="text-blue-400 text-sm">Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            className="bg-blue-500 rounded-2xl py-4 items-center mt-2"
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-lg font-semibold">Sign In</Text>
            )}
          </TouchableOpacity>

          <View className="flex-row items-center gap-4 my-2">
            <View className="flex-1 h-px bg-slate-700" />
            <Text className="text-slate-500 text-sm">or</Text>
            <View className="flex-1 h-px bg-slate-700" />
          </View>

          <View className="items-center mt-4">
            <Text className="text-slate-400 text-sm">
              Don't have an account?{" "}
              <Text
                className="text-blue-400 font-semibold"
                onPress={() => router.replace("/(auth)/register")}
              >
                Sign Up
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
