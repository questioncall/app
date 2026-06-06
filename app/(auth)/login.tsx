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
import {
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_OAUTH_REDIRECT_URI,
  GOOGLE_WEB_CLIENT_ID,
} from "@/lib/app-identity";
import { persistMobileAuthSession } from "@/lib/mobile-auth-session";
import { api } from "@/lib/api";
import {
  assertOkResponse,
  getRequestErrorMessage,
  readServerStatus,
} from "@/lib/server-response";

WebBrowser.maybeCompleteAuthSession();

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
    redirectUri: GOOGLE_OAUTH_REDIRECT_URI,
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
      className="mb-2 flex-row items-center justify-center gap-2 rounded-full border border-border bg-card py-4 shadow-sm"
      activeOpacity={0.85}
      disabled={disabled || !request}
      onPress={handleGoogleLogin}
    >
      {disabled ? (
        <ActivityIndicator color={iconColor} />
      ) : (
        <Ionicons name="logo-google" size={20} color={iconColor} />
      )}
      <Text className="text-[16px] font-semibold text-card-foreground">
        Sign in with Google
      </Text>
    </TouchableOpacity>
  );
}

export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loadingMethod, setLoadingMethod] = useState<LoginMethod>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { statusBarStyle, backgroundColor, iconColor } = useAppTheme();
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
      const res = await api.post("/mobile/login", payload, readServerStatus);
      assertOkResponse(res, "Login failed. Please try again.");

      const session = await persistMobileAuthSession(dispatch, res.data);
      if (session.isSuspended) {
        router.replace("/suspended");
      } else if (res.data?.user?.role === "ADMIN") {
        router.replace("/admin");
      } else {
        router.replace("/(tabs)/feed");
      }
    } catch (err: any) {
      setFormError(getRequestErrorMessage(err, "Login failed. Please try again."));
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

    await completeLogin({ email: email.trim().toLowerCase(), password }, "email");
  }

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="px-6 pb-8 pt-16">
            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                onPress={() => router.back()}
                className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
                activeOpacity={0.85}
              >
                <Ionicons name="arrow-back" size={20} color={iconColor} />
              </TouchableOpacity>

              <View className="h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card">
                <Image
                  source={require("../../assets/images/logo.png")}
                  style={{ width: 26, height: 26 }}
                  resizeMode="contain"
                />
              </View>
            </View>

            <Text className="mt-6 text-[32px] font-bold tracking-tight text-foreground">
              Welcome back
            </Text>
            <Text className="text-base text-muted-foreground">
              Sign in with email or Google.
            </Text>
          </View>

          {/* Form */}
          <View className="gap-5 px-6 pb-8">
            <View>
              <Text className="mb-2 ml-1 text-sm font-medium text-foreground">Email</Text>
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
              <View className="relative">
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Your password"
                  placeholderTextColor="#6B7280"
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  className="rounded-2xl border border-border bg-card px-5 py-4 pr-12 text-[15px] text-foreground"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 h-8 w-8 -translate-y-4 items-center justify-center rounded-full"
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={iconColor}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => router.push("/(auth)/forgot-password")}
              className="self-end"
            >
              <Text className="text-sm font-medium text-primary">Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loadingMethod !== null}
              className="mt-4 items-center rounded-full bg-primary py-4 shadow-lg"
              activeOpacity={0.85}
            >
              {loadingMethod === "email" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-[16px] font-semibold text-primary-foreground">
                  Sign In
                </Text>
              )}
            </TouchableOpacity>

            <AuthNotice tone="error" message={formError} />

            <View className="my-2 flex-row items-center gap-4">
              <View className="h-px flex-1 bg-border" />
              <Text className="text-sm text-muted-foreground">or</Text>
              <View className="h-px flex-1 bg-border" />
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
                  className="mb-2 flex-row items-center justify-center gap-2 rounded-full border border-border bg-card py-4 shadow-sm"
                  activeOpacity={0.85}
                  disabled
                >
                  <Ionicons name="logo-google" size={20} color={iconColor} />
                  <Text className="text-[16px] font-semibold text-card-foreground">
                    Sign in with Google
                  </Text>
                </TouchableOpacity>
                <Text className="px-2 text-center text-xs text-muted-foreground">
                  Google sign-in is not configured yet.
                </Text>
              </View>
            )}

            <View className="mt-2 items-center">
              <Text className="text-sm text-muted-foreground">
                Don{"'"}t have an account?{" "}
                <Text
                  className="font-bold text-foreground"
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
