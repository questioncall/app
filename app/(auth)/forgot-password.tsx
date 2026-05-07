import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { AuthNotice } from "@/components/auth/auth-notice";
import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";
import {
  assertSuccessResponse,
  getRequestErrorMessage,
  readServerStatus,
} from "@/lib/server-response";

type ResetStep = "email" | "code" | "password" | "done";
type ResetAction = "send-code" | "verify-code" | "reset-password" | null;

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<ResetStep>("email");
  const [loadingAction, setLoadingAction] = useState<ResetAction>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { statusBarStyle, backgroundColor, iconColor } = useAppTheme();

  function handleEmailChange(value: string) {
    if (step !== "email") {
      setEmail(value);
      setVerificationCode("");
      setNewPassword("");
      setStep("email");
      setFormError(null);
      setSuccessMessage(null);
      return;
    }

    setEmail(value);
  }

  async function handleSendCode() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setFormError("Please enter your email.");
      return;
    }

    setLoadingAction("send-code");
    setFormError(null);
    setSuccessMessage(null);

    try {
      const res = await api.post(
        "/auth/forgot-password/send",
        {
          email: normalizedEmail,
        },
        readServerStatus,
      );

      assertSuccessResponse(res, "Failed to send reset code.");

      setStep("code");
      setSuccessMessage("Verification code sent. Check your email.");
    } catch (err: any) {
      setFormError(
        getRequestErrorMessage(err, "Something went wrong. Please try again."),
      );
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleVerifyCode() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setFormError("Please enter your email.");
      return;
    }

    if (verificationCode.trim().length < 6) {
      setFormError("Please enter the 6-digit verification code.");
      return;
    }

    setLoadingAction("verify-code");
    setFormError(null);
    setSuccessMessage(null);

    try {
      const res = await api.post(
        "/auth/forgot-password/verify",
        {
          email: normalizedEmail,
          code: verificationCode.trim(),
        },
        readServerStatus,
      );

      assertSuccessResponse(res, "Failed to verify code. Please try again.");

      setStep("password");
      setSuccessMessage("Code verified. Set a new password.");
    } catch (err: any) {
      setFormError(
        getRequestErrorMessage(err, "Failed to verify code. Please try again."),
      );
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleResetPassword() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setFormError("Please enter your email.");
      return;
    }

    if (newPassword.trim().length < 8) {
      setFormError("Password must be at least 8 characters long.");
      return;
    }

    if (step !== "password") {
      setFormError("Please verify your code before resetting the password.");
      return;
    }

    setLoadingAction("reset-password");
    setFormError(null);
    setSuccessMessage(null);

    try {
      const res = await api.post(
        "/auth/forgot-password/reset",
        {
          email: normalizedEmail,
          code: verificationCode.trim(),
          newPassword,
        },
        readServerStatus,
      );

      assertSuccessResponse(res, "Failed to reset password. Please try again.");

      setStep("done");
      setSuccessMessage("Password reset successfully. You can sign in now.");
    } catch (err: any) {
      setFormError(
        getRequestErrorMessage(
          err,
          "Failed to reset password. Please try again.",
        ),
      );
    } finally {
      setLoadingAction(null);
    }
  }

  const stepIndex = step === "done" ? 4 : step === "email" ? 1 : step === "code" ? 2 : 3;

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 px-6 pb-6 pt-14">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="h-11 w-11 items-center justify-center rounded-full border border-border bg-card"
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-back" size={20} color={iconColor} />
            </TouchableOpacity>

            <View className="h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card">
              <Image
                source={require("../../assets/images/logo.png")}
                style={{ width: 28, height: 28 }}
                resizeMode="contain"
              />
            </View>

            <View className="flex-1">
              <Text className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                QuestionCall
              </Text>
              <Text className="text-[22px] font-bold tracking-tight text-foreground">
                Reset password
              </Text>
            </View>
          </View>

          <View className="mt-5 flex-row gap-2">
            {["Email", "Code", "Password"].map((label, index) => {
              const active = stepIndex === index + 1;
              const complete = stepIndex > index + 1;

              return (
                <View
                  key={label}
                  className={`flex-1 rounded-full border px-3 py-2 ${
                    active
                      ? "border-primary bg-primary/10"
                      : complete
                        ? "border-emerald-500/30 bg-emerald-500/10"
                        : "border-border bg-card"
                  }`}
                >
                  <Text
                    className={`text-center text-[11px] font-semibold uppercase tracking-[0.16em] ${
                      active || complete ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>

          <Text className="mt-5 max-w-sm text-[15px] leading-6 text-muted-foreground">
            We&apos;ll send a one-time code to your inbox, verify it, and then let you create a new password.
          </Text>

          <View className="mt-5 flex-1 justify-between">
            <View className="gap-4">
              {step === "email" ? (
                <View>
                  <Text className="mb-2 ml-1 text-sm font-medium text-foreground">
                    Email
                  </Text>
                  <TextInput
                    value={email}
                    onChangeText={handleEmailChange}
                    placeholder="you@example.com"
                    placeholderTextColor="#6B7280"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    className="rounded-2xl border border-border bg-card px-5 py-4 text-[15px] text-foreground"
                  />
                </View>
              ) : null}

              {step === "code" ? (
                <View>
                  <Text className="mb-2 ml-1 text-sm font-medium text-foreground">
                    Verification code
                  </Text>
                  <TextInput
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    placeholder="000000"
                    placeholderTextColor="#6B7280"
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="rounded-2xl border border-border bg-card px-5 py-4 text-[15px] text-foreground"
                  />
                  <TouchableOpacity
                    onPress={handleSendCode}
                    disabled={loadingAction === "send-code"}
                    className="mt-2 items-center py-2"
                    activeOpacity={0.85}
                  >
                    <Text className="text-sm font-semibold text-primary">
                      Resend code
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {step === "password" ? (
                <View>
                  <Text className="mb-2 ml-1 text-sm font-medium text-foreground">
                    New password
                  </Text>
                  <View className="relative">
                    <TextInput
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Create a new password"
                      placeholderTextColor="#6B7280"
                      secureTextEntry={!showPassword}
                      autoComplete="new-password"
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
              ) : null}

              {step === "done" ? (
                <View className="items-center rounded-3xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-6">
                  <Ionicons name="checkmark-circle-outline" size={40} color="#059669" />
                  <Text className="mt-3 text-center text-[20px] font-bold tracking-tight text-foreground">
                    Password updated
                  </Text>
                  <Text className="mt-2 text-center text-[14px] leading-6 text-muted-foreground">
                    You can sign in again with your new password now.
                  </Text>
                </View>
              ) : null}

              <AuthNotice tone="error" message={formError} />
              <AuthNotice tone="success" message={successMessage} />

              {step !== "done" ? (
                <TouchableOpacity
                  onPress={
                    step === "email"
                      ? handleSendCode
                      : step === "code"
                        ? handleVerifyCode
                        : handleResetPassword
                  }
                  disabled={loadingAction !== null}
                  className="items-center rounded-full bg-primary py-4 shadow-lg"
                  activeOpacity={0.85}
                >
                  {loadingAction === "send-code" ||
                  loadingAction === "verify-code" ||
                  loadingAction === "reset-password" ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="text-[16px] font-semibold text-primary-foreground">
                      {step === "email"
                        ? "Send code"
                        : step === "code"
                          ? "Verify code"
                          : "Reset password"}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>

            <View className="items-center pt-4">
              <TouchableOpacity onPress={() => router.replace("/(auth)/login")} activeOpacity={0.85}>
                <Text className="text-sm font-semibold text-foreground">
                  Back to sign in
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
