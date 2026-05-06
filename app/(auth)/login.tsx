import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Google from "expo-auth-session/providers/google";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useAppDispatch } from "@/hooks/redux";
import { useAppTheme } from "@/hooks/use-app-theme";
import { AuthNotice } from "@/components/auth/auth-notice";
import { persistMobileAuthSession } from "@/lib/mobile-auth-session";
import { api } from "@/lib/api";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim();
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();

type LoginMethod = "email" | "google" | null;

type GoogleLoginButtonProps = {
  iconColor: string;
  disabled: boolean;
  onGoogleLogin: (googleIdToken: string) => Promise<void>;
  onError: (message: string) => void;
  setLoadingMethod: Dispatch<SetStateAction<LoginMethod>>;
};

function GoogleLoginButton({
  iconColor,
  disabled,
  onGoogleLogin,
  onError,
  setLoadingMethod,
}: GoogleLoginButtonProps) {
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
    if (response?.type === "success") {
      const googleIdToken = response.params.id_token;
      if (!googleIdToken) {
        onError("Google sign-in did not return an ID token.");
        setLoadingMethod(null);
        return;
      }

      void onGoogleLogin(googleIdToken);
      return;
    }

    if (response && response.type !== "opened") {
      setLoadingMethod(null);
    }
  }, [onError, onGoogleLogin, response, setLoadingMethod]);

  async function handleGoogleLogin() {
    if (!request) {
      onError("Google sign-in is still preparing. Try again in a moment.");
      return;
    }

    setLoadingMethod("google");
    const result = await promptGoogleSignIn();
    if (result.type !== "success") {
      setLoadingMethod(null);
    }
  }

  return (
    <TouchableOpacity
      className="bg-card border border-border rounded-full py-4 items-center flex-row justify-center gap-2 mb-2 shadow-sm"
      activeOpacity={0.85}
      disabled={disabled || !request}
      onPress={handleGoogleLogin}
    >
      {disabled ? (
        <ActivityIndicator color={iconColor} />
      ) : (
        <Ionicons name="logo-google" size={20} color={iconColor} />
      )}
      <Text className="text-card-foreground text-[16px] font-semibold">
        Sign in with Google
      </Text>
    </TouchableOpacity>
  );
}

export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingMethod, setLoadingMethod] = useState<LoginMethod>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { statusBarStyle, iconColor } = useAppTheme();
  const isGoogleConfigured =
    Platform.OS === "android"
      ? Boolean(GOOGLE_ANDROID_CLIENT_ID)
      : Platform.OS === "ios"
        ? Boolean(GOOGLE_IOS_CLIENT_ID)
        : Boolean(GOOGLE_WEB_CLIENT_ID);

  async function completeLogin(
    payload: { email?: string; password?: string; googleIdToken?: string },
    method: Exclude<LoginMethod, null>,
  ) {
    setLoadingMethod(method);
    setFormError(null);
    try {
      const res = await api.post("/mobile/login", payload);
      const session = await persistMobileAuthSession(dispatch, res.data);
      router.replace(session.isSuspended ? "/suspended" : "/(tabs)/feed");
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ??
        err?.response?.data?.message ??
        "Login failed. Please try again.";
      setFormError(msg);
    } finally {
      setLoadingMethod(null);
    }
  }

  async function handleGoogleIdToken(googleIdToken: string) {
    await completeLogin({ googleIdToken }, "google");
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setFormError("Please fill in all fields.");
      return;
    }

    await completeLogin(
      { email: email.trim().toLowerCase(), password },
      "email",
    );
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
          {/* Header */}
          <View className="px-6 pt-16 pb-8">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mb-6 w-10 h-10 items-center justify-center bg-card border border-border rounded-full"
            >
              <Ionicons name="arrow-back" size={20} color={iconColor} />
            </TouchableOpacity>

            <Image 
              source={require("../../assets/images/logo.png")} 
              style={{ width: 64, height: 64, marginBottom: 16, borderRadius: 16 }} 
              resizeMode="contain"
            />
            <Text className="text-foreground text-[32px] font-bold mb-2 tracking-tight">
              Welcome back
            </Text>
            <Text className="text-muted-foreground text-base">
              Sign in with email or Google.
            </Text>
          </View>

          {/* Form */}
          <View className="px-6 gap-5 pb-8">
            <View>
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
                className="bg-card border border-border rounded-2xl px-5 py-4 text-foreground text-[15px]"
              />
            </View>

            <View>
              <Text className="text-foreground text-sm font-medium mb-2 ml-1">
                Password
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                placeholderTextColor="#6B7280"
                secureTextEntry
                autoComplete="password"
                className="bg-card border border-border rounded-2xl px-5 py-4 text-foreground text-[15px]"
              />
            </View>

            <TouchableOpacity
              onPress={() => router.push("/(auth)/forgot-password")}
              className="self-end"
            >
              <Text className="text-primary text-sm font-medium">Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loadingMethod !== null}
              className="bg-primary rounded-full py-4 items-center mt-4 shadow-lg"
              activeOpacity={0.85}
            >
              {loadingMethod === "email" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-primary-foreground text-[16px] font-semibold">Sign In</Text>
              )}
            </TouchableOpacity>

            <AuthNotice tone="error" message={formError} />

            <View className="flex-row items-center gap-4 my-2">
              <View className="flex-1 h-px bg-border" />
              <Text className="text-muted-foreground text-sm">or</Text>
              <View className="flex-1 h-px bg-border" />
            </View>

            {isGoogleConfigured ? (
              <GoogleLoginButton
                iconColor={iconColor}
                disabled={loadingMethod !== null}
                onGoogleLogin={handleGoogleIdToken}
                onError={setFormError}
                setLoadingMethod={setLoadingMethod}
              />
            ) : (
              <View className="opacity-60">
                <TouchableOpacity
                  className="bg-card border border-border rounded-full py-4 items-center flex-row justify-center gap-2 mb-2 shadow-sm"
                  activeOpacity={0.85}
                  disabled
                >
                  <Ionicons name="logo-google" size={20} color={iconColor} />
                  <Text className="text-card-foreground text-[16px] font-semibold">
                    Sign in with Google
                  </Text>
                </TouchableOpacity>
                <Text className="px-2 text-center text-xs text-muted-foreground">
                  Google sign-in is not configured yet.
                </Text>
              </View>
            )}

            <View className="items-center mt-2">
              <Text className="text-muted-foreground text-sm">
                Don{"'"}t have an account?{" "}
                <Text
                  className="text-foreground font-bold"
                  onPress={() => router.replace("/(auth)/register")}
                >
                  Sign Up
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
