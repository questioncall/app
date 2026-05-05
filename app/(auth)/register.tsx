import { useState, useEffect } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
import Toast from "react-native-toast-message";
import api from "@/lib/api";

type Role = "STUDENT" | "TEACHER";

export default function RegisterScreen() {
  const params = useLocalSearchParams<{ ref?: string }>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("STUDENT");
  const [referralCode, setReferralCode] = useState(params.ref ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (params.ref) setReferralCode(params.ref);
  }, [params.ref]);

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Toast.show({ type: "error", text1: "Please fill in all fields" });
      return;
    }
    if (password.length < 6) {
      Toast.show({
        type: "error",
        text1: "Password must be at least 6 characters",
      });
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/register", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        referralCode: referralCode.trim() || undefined,
      });

      router.replace("/(auth)/verify-email");
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? "Registration failed. Please try again.";
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
        <View className="px-6 pt-16 pb-6">
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
            Create account
          </Text>
          <Text className="text-slate-400 text-base">
            Join QuestionCall today
          </Text>
        </View>

        {/* Role toggle */}
        <View className="px-6 mb-4">
          <Text className="text-slate-400 text-sm font-medium mb-2">
            I am a...
          </Text>
          <View className="flex-row bg-slate-900 rounded-xl p-1">
            <TouchableOpacity
              onPress={() => setRole("STUDENT")}
              className={`flex-1 py-3 rounded-lg items-center ${
                role === "STUDENT" ? "bg-blue-500" : ""
              }`}
            >
              <Text
                className={`font-semibold ${
                  role === "STUDENT" ? "text-white" : "text-slate-400"
                }`}
              >
                Student
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setRole("TEACHER")}
              className={`flex-1 py-3 rounded-lg items-center ${
                role === "TEACHER" ? "bg-blue-500" : ""
              }`}
            >
              <Text
                className={`font-semibold ${
                  role === "TEACHER" ? "text-white" : "text-slate-400"
                }`}
              >
                Teacher
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Form */}
        <View className="px-6 gap-4">
          <View>
            <Text className="text-slate-400 text-sm font-medium mb-2">
              Full Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              placeholderTextColor="#475569"
              autoCapitalize="words"
              autoComplete="name"
              className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 text-white text-base"
            />
          </View>

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
              placeholder="At least 6 characters"
              placeholderTextColor="#475569"
              secureTextEntry
              autoComplete="new-password"
              className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 text-white text-base"
            />
          </View>

          <View>
            <Text className="text-slate-400 text-sm font-medium mb-2">
              Referral Code{" "}
              <Text className="text-slate-600">(optional)</Text>
            </Text>
            <TextInput
              value={referralCode}
              onChangeText={setReferralCode}
              placeholder="Enter referral code"
              placeholderTextColor="#475569"
              autoCapitalize="characters"
              className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 text-white text-base"
            />
          </View>

          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            className="bg-blue-500 rounded-2xl py-4 items-center mt-2"
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-lg font-semibold">
                Create Account
              </Text>
            )}
          </TouchableOpacity>

          <View className="items-center mt-4 mb-8">
            <Text className="text-slate-400 text-sm">
              Already have an account?{" "}
              <Text
                className="text-blue-400 font-semibold"
                onPress={() => router.replace("/(auth)/login")}
              >
                Sign In
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
