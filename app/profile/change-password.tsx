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
import Toast from "react-native-toast-message";

import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";

export default function ChangePasswordScreen() {
  const {
    statusBarStyle,
    backgroundColor,
    primaryColor,
    primarySoftColor,
    mutedIconColor,
    iconColor,
  } = useAppTheme();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!currentPassword) {
      Toast.show({ type: "error", text1: "Enter your current password." });
      return;
    }
    if (newPassword.length < 8) {
      Toast.show({ type: "error", text1: "New password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      Toast.show({ type: "error", text1: "Passwords don't match." });
      return;
    }
    if (newPassword === currentPassword) {
      Toast.show({
        type: "error",
        text1: "New password must differ from the current one.",
      });
      return;
    }

    setSaving(true);
    try {
      await api.post("/users/change-password", { currentPassword, newPassword });
      Toast.show({ type: "success", text1: "Password changed successfully." });
      router.back();
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1:
          err?.response?.data?.error ??
          err?.response?.data?.message ??
          "Failed to change password.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
    >
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="px-5 pt-14">
          <View className="mb-7 flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => router.back()}
              className="h-11 w-11 items-center justify-center rounded-full bg-secondary"
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={20} color={iconColor} />
            </TouchableOpacity>
            <Text className="text-base font-bold text-foreground">Change Password</Text>
            <View className="h-11 w-11" />
          </View>

          <View className="mb-8 items-center">
            <View
              className="h-20 w-20 items-center justify-center rounded-full"
              style={{ backgroundColor: primarySoftColor }}
            >
              <Ionicons name="lock-closed-outline" size={36} color={primaryColor} />
            </View>
            <Text className="mt-3 text-center text-sm text-muted-foreground">
              Your new password must be at least 8 characters.
            </Text>
          </View>

          <View className="overflow-hidden rounded-[24px] border border-border bg-card">
            <PasswordField
              label="Current Password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              show={showCurrent}
              onToggleShow={() => setShowCurrent((v) => !v)}
              mutedColor={mutedIconColor}
            />
            <View className="h-px bg-border" />
            <PasswordField
              label="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              show={showNew}
              onToggleShow={() => setShowNew((v) => !v)}
              mutedColor={mutedIconColor}
            />
            <View className="h-px bg-border" />
            <PasswordField
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              show={showConfirm}
              onToggleShow={() => setShowConfirm((v) => !v)}
              mutedColor={mutedIconColor}
            />
          </View>

          {newPassword.length > 0 && (
            <StrengthBar password={newPassword} primaryColor={primaryColor} />
          )}

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            className="mt-8 items-center justify-center rounded-full"
            style={{ backgroundColor: primaryColor, height: 54 }}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-bold text-white">Update Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PasswordField({
  label,
  value,
  onChangeText,
  show,
  onToggleShow,
  mutedColor,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  mutedColor: string;
}) {
  return (
    <View className="px-4 py-4">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </Text>
      <View className="flex-row items-center">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={mutedColor}
          placeholder="••••••••"
          className="flex-1 text-[16px] text-card-foreground"
        />
        <TouchableOpacity onPress={onToggleShow} className="ml-2 p-1">
          <Ionicons
            name={show ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={mutedColor}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StrengthBar({
  password,
  primaryColor,
}: {
  password: string;
  primaryColor: string;
}) {
  const score = getStrengthScore(password);
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e"];
  const labels = ["Weak", "Fair", "Good", "Strong"];
  const color = colors[score - 1] ?? "#ef4444";
  const label = labels[score - 1] ?? "Weak";

  return (
    <View className="mt-3">
      <View className="flex-row gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            className="h-1.5 flex-1 rounded-full"
            style={{ backgroundColor: i <= score ? color : "#e5e7eb" }}
          />
        ))}
      </View>
      <Text className="mt-1 text-xs" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

function getStrengthScore(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.max(1, score);
}
