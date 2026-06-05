import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import Toast from "react-native-toast-message";

import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { persistor, resetStore } from "@/store";
import { api, SECURE_STORE_KEYS } from "@/lib/api";
import { resetPusherClient } from "@/lib/realtime";
import { getCurrentPushToken, unsubscribePushToken } from "@/lib/push-notifications";
import { useAppTheme } from "@/hooks/use-app-theme";

type ComponentIcon = React.ComponentProps<typeof Ionicons>["name"];

const DANGER = "#EF4444";
const DANGER_SOFT = "rgba(239,68,68,0.12)";

const REASONS = [
  "I no longer need QuestionCall",
  "I found a better alternative",
  "Too many notifications",
  "I have privacy concerns",
  "I'm having technical problems",
  "Other",
];

const RECOVERY_STEPS: { icon: ComponentIcon; text: string }[] = [
  {
    icon: "log-in-outline",
    text: "Open QuestionCall and tap “Sign in” on the landing screen.",
  },
  {
    icon: "key-outline",
    text: "Tap “Forgot Password”.",
  },
  {
    icon: "mail-outline",
    text: "Enter the email address on this account.",
  },
  {
    icon: "shield-checkmark-outline",
    text: "Enter the one-time code (OTP) we email you and set a new password.",
  },
  {
    icon: "checkmark-done-outline",
    text: "Your account and all your data are restored.",
  },
];

export default function DeleteAccountScreen() {
  const dispatch = useAppDispatch();
  const { statusBarStyle, backgroundColor, iconColor, mutedIconColor, primaryColor } =
    useAppTheme();

  // Google-only accounts have no password, so we skip the password prompt.
  // Default to requiring it if we don't know yet (safer).
  const accountHasPassword = useAppSelector((s) => s.user.data?.hasPassword) ?? true;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canContinueStep1 = reason !== null || details.trim().length > 0;

  function goBack() {
    if (submitting) return;
    if (step === 1) {
      router.back();
    } else {
      setStep((s) => (s === 3 ? 2 : 1));
    }
  }

  async function purgeLocalSession() {
    const pushToken = getCurrentPushToken();
    if (pushToken) await unsubscribePushToken(pushToken);

    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
    dispatch(resetStore());
    await persistor.purge();
    resetPusherClient();
  }

  async function handleDelete() {
    if (submitting) return;

    const fullReason = [reason, details.trim()].filter(Boolean).join(" — ");

    setSubmitting(true);
    try {
      await api.delete("/account", {
        data: {
          confirm: "DELETE",
          ...(password ? { password } : {}),
          ...(fullReason ? { reason: fullReason } : {}),
        },
      });

      await purgeLocalSession();
      router.replace("/");
      Toast.show({
        type: "success",
        text1: "Account deleted",
        text2: "You can recover it within 30 days via Forgot Password.",
        visibilityTime: 5000,
      });
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1:
          err?.response?.data?.error ??
          err?.response?.data?.message ??
          "Failed to delete account.",
      });
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
    >
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* Header */}
      <View className="px-5 pt-14">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={goBack}
            className="h-11 w-11 items-center justify-center rounded-full bg-secondary"
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color={iconColor} />
          </TouchableOpacity>
          <Text className="text-base font-bold text-foreground">Delete Account</Text>
          <View className="h-11 w-11" />
        </View>

        {/* Step progress */}
        <View className="mt-5 flex-row gap-1.5">
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              className="h-1.5 flex-1 rounded-full"
              style={{ backgroundColor: i <= step ? DANGER : `${mutedIconColor}33` }}
            />
          ))}
        </View>
        <Text className="mt-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Step {step} of 3
        </Text>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 40,
          paddingTop: 8,
        }}
      >
        {step === 1 ? (
          <StepReason
            reason={reason}
            setReason={setReason}
            details={details}
            setDetails={setDetails}
            primaryColor={primaryColor}
            mutedIconColor={mutedIconColor}
          />
        ) : step === 2 ? (
          <StepRecovery primaryColor={primaryColor} />
        ) : (
          <StepConfirm
            accountHasPassword={accountHasPassword}
            password={password}
            setPassword={setPassword}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            mutedIconColor={mutedIconColor}
          />
        )}
      </ScrollView>

      {/* Footer actions */}
      <View
        className="border-t border-border bg-background px-5 pt-3"
        style={{ paddingBottom: Platform.OS === "ios" ? 28 : 16 }}
      >
        {step === 1 ? (
          <PrimaryButton
            label="Next"
            color={primaryColor}
            disabled={!canContinueStep1}
            onPress={() => setStep(2)}
          />
        ) : step === 2 ? (
          <PrimaryButton label="Next" color={primaryColor} onPress={() => setStep(3)} />
        ) : (
          <>
            <PrimaryButton
              label="Yes, delete my account"
              color={DANGER}
              loading={submitting}
              disabled={accountHasPassword && password.trim().length === 0}
              onPress={handleDelete}
            />
            <TouchableOpacity
              onPress={() => !submitting && router.back()}
              disabled={submitting}
              className="mt-2 items-center justify-center py-3"
              activeOpacity={0.7}
            >
              <Text className="text-[15px] font-semibold text-foreground">
                No, keep my account
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

/* ── Step 1: reason ─────────────────────────────────────────────── */
function StepReason({
  reason,
  setReason,
  details,
  setDetails,
  primaryColor,
  mutedIconColor,
}: {
  reason: string | null;
  setReason: (r: string) => void;
  details: string;
  setDetails: (v: string) => void;
  primaryColor: string;
  mutedIconColor: string;
}) {
  return (
    <View>
      <Text className="mt-2 text-[22px] font-bold tracking-tight text-foreground">
        We&apos;re sorry to see you go
      </Text>
      <Text className="mt-2 text-sm leading-6 text-muted-foreground">
        Before you leave, help us improve — why are you deleting your account?
      </Text>

      <View className="mt-5 gap-2.5">
        {REASONS.map((item) => {
          const selected = reason === item;
          return (
            <TouchableOpacity
              key={item}
              onPress={() => setReason(item)}
              activeOpacity={0.85}
              className="flex-row items-center rounded-2xl border bg-card px-4 py-3.5"
              style={{
                borderColor: selected ? primaryColor : "transparent",
                borderWidth: selected ? 1.5 : 1,
              }}
            >
              <Ionicons
                name={selected ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={selected ? primaryColor : mutedIconColor}
              />
              <Text className="ml-3 flex-1 text-[15px] text-card-foreground">{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text className="mb-2 mt-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Tell us more (optional)
      </Text>
      <TextInput
        value={details}
        onChangeText={setDetails}
        placeholder="Share anything that could help us do better…"
        placeholderTextColor={mutedIconColor}
        multiline
        textAlignVertical="top"
        className="min-h-[96px] rounded-2xl border border-border bg-card px-4 py-3 text-[15px] text-card-foreground"
      />
    </View>
  );
}

/* ── Step 2: recovery info ──────────────────────────────────────── */
function StepRecovery({ primaryColor }: { primaryColor: string }) {
  return (
    <View>
      <View className="mt-2 flex-row items-center gap-3">
        <View
          className="h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${primaryColor}1A` }}
        >
          <Ionicons name="time-outline" size={26} color={primaryColor} />
        </View>
        <View className="flex-1">
          <Text className="text-[22px] font-bold tracking-tight text-foreground">
            You have 30 days
          </Text>
          <Text className="text-sm text-muted-foreground">to change your mind</Text>
        </View>
      </View>

      <Text className="mt-4 text-sm leading-6 text-muted-foreground">
        Deleting your account signs you out right away, but we keep your data for 30 days.
        You can restore everything within that window — here&apos;s how:
      </Text>

      <View className="mt-5 overflow-hidden rounded-[24px] border border-border bg-card">
        {RECOVERY_STEPS.map((item, index) => (
          <View key={item.text}>
            {index > 0 ? <View className="mx-4 h-px bg-border" /> : null}
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <View
                className="h-9 w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${primaryColor}1A` }}
              >
                <Ionicons name={item.icon} size={18} color={primaryColor} />
              </View>
              <Text className="flex-1 text-[13px] leading-5 text-card-foreground">
                {item.text}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View className="mt-4 flex-row gap-2.5 rounded-2xl border border-border bg-card px-4 py-3.5">
        <Ionicons name="alert-circle-outline" size={18} color={DANGER} />
        <Text className="flex-1 text-[13px] leading-5 text-muted-foreground">
          After 30 days your account and data are permanently removed and can no longer be
          recovered.
        </Text>
      </View>
    </View>
  );
}

/* ── Step 3: final confirm ──────────────────────────────────────── */
function StepConfirm({
  accountHasPassword,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  mutedIconColor,
}: {
  accountHasPassword: boolean;
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  mutedIconColor: string;
}) {
  return (
    <View>
      <View className="mt-2 items-center">
        <View
          className="h-20 w-20 items-center justify-center rounded-full"
          style={{ backgroundColor: DANGER_SOFT }}
        >
          <Ionicons name="trash-outline" size={36} color={DANGER} />
        </View>
        <Text className="mt-4 text-center text-[22px] font-bold tracking-tight text-foreground">
          Do you really want to delete your account?
        </Text>
        <Text className="mt-2 text-center text-sm leading-6 text-muted-foreground">
          This is the last step. You&apos;ll be signed out immediately, with 30 days to
          recover your account before it&apos;s gone for good.
        </Text>
      </View>

      {accountHasPassword ? (
        <>
          <Text className="mb-2 mt-7 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Confirm your password
          </Text>
          <View className="flex-row items-center rounded-2xl border border-border bg-card px-4 py-3.5">
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Enter your password"
              placeholderTextColor={mutedIconColor}
              className="flex-1 text-[16px] text-card-foreground"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              className="ml-2 p-1"
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={mutedIconColor}
              />
            </TouchableOpacity>
          </View>
          <Text className="mt-2 text-[11px] leading-4 text-muted-foreground">
            Enter your password to confirm it&apos;s really you.
          </Text>
        </>
      ) : (
        <View className="mt-7 flex-row gap-2.5 rounded-2xl border border-border bg-card px-4 py-3.5">
          <Ionicons name="logo-google" size={18} color={mutedIconColor} />
          <Text className="flex-1 text-[13px] leading-5 text-muted-foreground">
            You signed in with Google, so no password is needed. Tap below to delete your
            account.
          </Text>
        </View>
      )}
    </View>
  );
}

/* ── Shared footer button ───────────────────────────────────────── */
function PrimaryButton({
  label,
  color,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      className="items-center justify-center rounded-full"
      style={{ backgroundColor: color, height: 54, opacity: isDisabled ? 0.5 : 1 }}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text className="text-base font-bold text-white">{label}</Text>
      )}
    </TouchableOpacity>
  );
}
