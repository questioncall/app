import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
  StatusBar,
  Modal,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Google from "expo-auth-session/providers/google";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useAppDispatch } from "@/hooks/redux";
import { useAppTheme } from "@/hooks/use-app-theme";
import { AuthNotice } from "@/components/auth/auth-notice";
import { persistMobileAuthSession } from "@/lib/mobile-auth-session";
import { api } from "@/lib/api";

WebBrowser.maybeCompleteAuthSession();

type Role = "STUDENT" | "TEACHER";
type RegisterMethod = "email" | "google" | null;

const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim();
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();

export default function RegisterScreen() {
  const params = useLocalSearchParams<{ ref?: string }>();
  const dispatch = useAppDispatch();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("STUDENT");
  const [referralCode, setReferralCode] = useState(params.ref ?? "");
  const [loadingMethod, setLoadingMethod] = useState<RegisterMethod>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isGoogleConfirmOpen, setIsGoogleConfirmOpen] = useState(false);
  const { statusBarStyle, iconColor } = useAppTheme();

  const isGoogleConfigured =
    Platform.OS === "android"
      ? Boolean(GOOGLE_ANDROID_CLIENT_ID)
      : Platform.OS === "ios"
        ? Boolean(GOOGLE_IOS_CLIENT_ID)
        : Boolean(GOOGLE_WEB_CLIENT_ID);

  const [request, response, promptGoogleSignIn] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    redirectUri:
      Platform.OS === "web" ? undefined : "com.siddthecoder.qustioncall:/login",
    scopes: ["openid", "profile", "email"],
    selectAccount: true,
  });

  useEffect(() => {
    if (params.ref) {
      setReferralCode(params.ref);
    }
  }, [params.ref]);

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setFormError("Please fill in all fields.");
      return;
    }

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }

    setLoadingMethod("email");
    setFormError(null);
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
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        "Registration failed. Please try again.";
      setFormError(msg);
    } finally {
      setLoadingMethod(null);
    }
  }

  const handleGoogleSignup = useCallback(async (googleIdToken: string) => {
    setFormError(null);
    try {
      const res = await api.post("/mobile/register", {
        googleIdToken,
        role,
        referralCode: referralCode.trim() || undefined,
      });

      const session = await persistMobileAuthSession(dispatch, res.data);
      router.replace(session.isSuspended ? "/suspended" : "/(tabs)/feed");
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ??
        err?.response?.data?.message ??
        "Google sign-up failed. Please try again.";
      setFormError(msg);
    } finally {
      setLoadingMethod(null);
    }
  }, [dispatch, referralCode, role]);

  useEffect(() => {
    if (response?.type === "success") {
      const googleIdToken = response.params.id_token;
      if (!googleIdToken) {
        setFormError("Google sign-up did not return an ID token.");
        setLoadingMethod(null);
        return;
      }

      void handleGoogleSignup(googleIdToken);
      return;
    }

    if (response && response.type !== "opened") {
      setLoadingMethod(null);
    }
  }, [handleGoogleSignup, response]);

  async function handleGoogleSignupPress() {
    if (!isGoogleConfigured) {
      setFormError("Google sign-up is not configured yet.");
      return;
    }

    if (!request) {
      setFormError("Google sign-in is still preparing. Try again in a moment.");
      return;
    }

    setIsGoogleConfirmOpen(true);
  }

  async function confirmGoogleSignup() {
    setIsGoogleConfirmOpen(false);
    setFormError(null);
    setLoadingMethod("google");

    const result = await promptGoogleSignIn();
    if (result.type !== "success") {
      setLoadingMethod(null);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-6 pt-16 pb-6">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mb-6 h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
            >
              <Ionicons name="arrow-back" size={20} color={iconColor} />
            </TouchableOpacity>

            <Image
              source={require("../../assets/images/logo.png")}
              style={{ width: 64, height: 64, marginBottom: 16, borderRadius: 16 }}
              resizeMode="contain"
            />
            <Text className="mb-2 text-[32px] font-bold tracking-tight text-foreground">
              Create account
            </Text>
            <Text className="text-base text-muted-foreground">
              Choose a role, then sign up with email or Google.
            </Text>
          </View>

          <View className="px-6 pb-8">
            <View className="mb-6">
              <Text className="mb-2 ml-1 text-sm font-medium text-foreground">
                I am a
              </Text>
              <View className="flex-row rounded-2xl border border-border bg-card p-1 shadow-sm">
                <TouchableOpacity
                  onPress={() => setRole("STUDENT")}
                  className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3 ${
                    role === "STUDENT" ? "bg-primary" : ""
                  }`}
                >
                  <Ionicons
                    name="school-outline"
                    size={18}
                    color={role === "STUDENT" ? "#FFFFFF" : iconColor}
                  />
                  <Text
                    className={`text-[15px] font-semibold ${
                      role === "STUDENT"
                        ? "text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    Student
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setRole("TEACHER")}
                  className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3 ${
                    role === "TEACHER" ? "bg-primary" : ""
                  }`}
                >
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={role === "TEACHER" ? "#FFFFFF" : iconColor}
                  />
                  <Text
                    className={`text-[15px] font-semibold ${
                      role === "TEACHER"
                        ? "text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    Teacher
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {referralCode.trim() ? (
              <View className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-400/30 dark:bg-blue-500/10">
                <Text className="text-sm font-medium text-blue-700 dark:text-blue-200">
                  Referral code detected. Any eligible bonus will be applied
                  after signup.
                </Text>
              </View>
            ) : null}

            <View className="gap-5">
              <View>
                <Text className="mb-2 ml-1 text-sm font-medium text-foreground">
                  Full Name
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your full name"
                  placeholderTextColor="#6B7280"
                  autoCapitalize="words"
                  autoComplete="name"
                  className="rounded-2xl border border-border bg-card px-5 py-4 text-[15px] text-foreground"
                />
              </View>

              <View>
                <Text className="mb-2 ml-1 text-sm font-medium text-foreground">
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
                  className="rounded-2xl border border-border bg-card px-5 py-4 text-[15px] text-foreground"
                />
              </View>

              <View>
                <Text className="mb-2 ml-1 text-sm font-medium text-foreground">
                  Password
                </Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 8 characters"
                  placeholderTextColor="#6B7280"
                  secureTextEntry
                  autoComplete="new-password"
                  className="rounded-2xl border border-border bg-card px-5 py-4 text-[15px] text-foreground"
                />
              </View>

              <View>
                <Text className="mb-2 ml-1 text-sm font-medium text-foreground">
                  Referral Code{" "}
                  <Text className="text-xs text-muted-foreground">(optional)</Text>
                </Text>
                <TextInput
                  value={referralCode}
                  onChangeText={setReferralCode}
                  placeholder="Enter referral code"
                  placeholderTextColor="#6B7280"
                  autoCapitalize="characters"
                  className="rounded-2xl border border-border bg-card px-5 py-4 text-[15px] text-foreground"
                />
              </View>

              <AuthNotice tone="error" message={formError} />

              <TouchableOpacity
                onPress={handleRegister}
                disabled={loadingMethod !== null}
                className="mt-2 items-center rounded-full bg-primary py-4 shadow-lg"
                activeOpacity={0.85}
              >
                {loadingMethod === "email" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-[16px] font-semibold text-primary-foreground">
                    Create Account
                  </Text>
                )}
              </TouchableOpacity>

              <View className="flex-row items-center gap-4">
                <View className="h-px flex-1 bg-border" />
                <Text className="text-sm text-muted-foreground">or</Text>
                <View className="h-px flex-1 bg-border" />
              </View>

              {isGoogleConfigured ? (
                <TouchableOpacity
                  onPress={handleGoogleSignupPress}
                  disabled={loadingMethod !== null || !request}
                  className="flex-row items-center justify-center gap-2 rounded-full border border-border bg-card py-4 shadow-sm"
                  activeOpacity={0.85}
                >
                  {loadingMethod === "google" ? (
                    <ActivityIndicator color={iconColor} />
                  ) : (
                    <Ionicons name="logo-google" size={20} color={iconColor} />
                  )}
                  <Text className="text-[16px] font-semibold text-card-foreground">
                    Continue with Google
                  </Text>
                </TouchableOpacity>
              ) : (
                <View className="opacity-60">
                  <TouchableOpacity
                    disabled
                    className="flex-row items-center justify-center gap-2 rounded-full border border-border bg-card py-4 shadow-sm"
                    activeOpacity={0.85}
                  >
                    <Ionicons name="logo-google" size={20} color={iconColor} />
                    <Text className="text-[16px] font-semibold text-card-foreground">
                      Continue with Google
                    </Text>
                  </TouchableOpacity>
                  <Text className="px-2 pt-2 text-center text-xs text-muted-foreground">
                    Google sign-up is not configured yet.
                  </Text>
                </View>
              )}

              <View className="items-center pt-2">
                <Text className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Text
                    className="font-bold text-foreground"
                    onPress={() => router.replace("/(auth)/login")}
                  >
                    Sign In
                  </Text>
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        transparent
        animationType="fade"
        visible={isGoogleConfirmOpen}
        onRequestClose={() => setIsGoogleConfirmOpen(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/55 px-6">
          <View className="w-full max-w-md rounded-[28px] border border-border bg-card px-5 py-6">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Ionicons name="logo-google" size={24} color={iconColor} />
            </View>
            <Text className="text-[22px] font-bold tracking-tight text-foreground">
              Continue with Google?
            </Text>
            <Text className="mt-2 text-[15px] leading-6 text-muted-foreground">
              This will create a{" "}
              <Text className="font-semibold text-foreground">
                {role.toLowerCase()}
              </Text>{" "}
              account and sign you in right away.
            </Text>

            <View className="mt-4 rounded-2xl border border-border bg-muted/30 px-4 py-3">
              <Text className="text-sm font-semibold text-foreground">
                Selected role
              </Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                {role === "STUDENT" ? "Student" : "Teacher"}
              </Text>
            </View>

            <View className="mt-5 flex-row gap-3">
              <Pressable
                onPress={() => setIsGoogleConfirmOpen(false)}
                className="flex-1 items-center rounded-full border border-border bg-background py-3.5"
              >
                <Text className="text-[15px] font-semibold text-foreground">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={confirmGoogleSignup}
                className="flex-1 items-center rounded-full bg-primary py-3.5"
              >
                <Text className="text-[15px] font-semibold text-primary-foreground">
                  Continue
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
