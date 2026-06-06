import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  Alert,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";
import { getRequestErrorMessage } from "@/lib/server-response";
import { readCache, writeCache } from "@/lib/admin-cache";

type DeveloperConfig = {
  emails: string[];
  errorThreshold: number;
  enabled: boolean;
  lastAlertSent?: string | null;
};

export default function AdminDeveloperScreen() {
  const insets = useSafeAreaInsets();
  const { statusBarStyle, backgroundColor, iconColor, primaryColor } = useAppTheme();

  const seed = readCache<DeveloperConfig>("developer");
  const [config, setConfig] = useState<DeveloperConfig | null>(seed ?? null);
  const [loading, setLoading] = useState(() => seed === undefined);
  const [busy, setBusy] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [threshold, setThreshold] = useState(String(seed?.errorThreshold ?? 4));

  const load = useCallback(async () => {
    try {
      const res = await api.get("/mobile/admin/developer");
      const data = res.data as DeveloperConfig;
      setConfig(data);
      setThreshold(String(data.errorThreshold ?? 4));
      writeCache("developer", data);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to load settings",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      try {
        await api.patch("/mobile/admin/developer", body);
        await load();
        return true;
      } catch (err) {
        Toast.show({
          type: "error",
          text1: "Action failed",
          text2: getRequestErrorMessage(err, "Please try again."),
          position: "bottom",
        });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const addEmail = useCallback(() => {
    const email = newEmail.trim().toLowerCase();
    if (!email.includes("@")) {
      Toast.show({ type: "error", text1: "Enter a valid email", position: "bottom" });
      return;
    }
    if (config?.emails.includes(email)) {
      Toast.show({ type: "error", text1: "Email already added", position: "bottom" });
      return;
    }
    void patch({ action: "addEmail", email }).then((ok) => {
      if (ok) setNewEmail("");
    });
  }, [newEmail, config, patch]);

  const removeEmail = useCallback(
    (email: string) => {
      Alert.alert("Remove email?", email, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void patch({ action: "removeEmail", email }),
        },
      ]);
    },
    [patch],
  );

  const saveThreshold = useCallback(() => {
    const num = Number(threshold);
    if (!Number.isFinite(num) || num < 1 || num > 100) {
      Toast.show({ type: "error", text1: "Threshold must be 1–100", position: "bottom" });
      return;
    }
    void patch({ action: "setThreshold", threshold: num });
  }, [threshold, patch]);

  const sendTestAlert = useCallback(async () => {
    setBusy(true);
    try {
      await api.post("/mobile/admin/developer", {});
      Toast.show({ type: "success", text1: "Test alert sent!", position: "bottom" });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to send test alert",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      <View
        className="border-b border-border px-5 pb-3"
        style={{ paddingTop: Math.max(insets.top + 8, 36) }}
      >
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={20} color={iconColor} />
          </TouchableOpacity>
          <Text className="text-[18px] font-bold tracking-tight text-foreground">
            Developer
          </Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom + 32, 40),
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Alert settings */}
          <View className="rounded-2xl border border-border bg-card p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-[14px] font-semibold text-foreground">
                  Error alerts
                </Text>
                <Text className="text-[12px] text-muted-foreground">
                  Email devs when an error repeats past the threshold
                </Text>
              </View>
              <Switch
                value={config?.enabled ?? false}
                disabled={busy}
                onValueChange={(enabled) => void patch({ action: "setEnabled", enabled })}
                trackColor={{ true: primaryColor }}
              />
            </View>

            <Text className="mb-1 mt-4 text-[12px] font-medium text-foreground">
              Error threshold
            </Text>
            <View className="flex-row items-center gap-2">
              <TextInput
                value={threshold}
                onChangeText={setThreshold}
                keyboardType="numeric"
                placeholderTextColor="#6B7280"
                className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
              />
              <TouchableOpacity
                onPress={saveThreshold}
                disabled={busy}
                activeOpacity={0.85}
                className="flex-row items-center gap-1.5 rounded-2xl px-4 py-3"
                style={{ backgroundColor: primaryColor }}
              >
                <Ionicons name="save-outline" size={16} color="#fff" />
                <Text className="text-[13px] font-semibold text-white">Save</Text>
              </TouchableOpacity>
            </View>

            {config?.lastAlertSent ? (
              <Text className="mt-3 text-[11px] text-muted-foreground">
                Last alert: {new Date(config.lastAlertSent).toLocaleString()}
              </Text>
            ) : null}

            <TouchableOpacity
              onPress={sendTestAlert}
              disabled={busy}
              activeOpacity={0.85}
              className="mt-4 flex-row items-center justify-center gap-1.5 rounded-full border border-border py-3"
            >
              <Ionicons name="mail-outline" size={16} color={iconColor} />
              <Text className="text-[13px] font-semibold text-foreground">
                Send test alert
              </Text>
            </TouchableOpacity>
          </View>

          {/* Developer emails */}
          <Text className="mb-2 ml-1 mt-7 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Developer emails
          </Text>
          <View className="flex-row gap-2">
            <TextInput
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="developer@example.com"
              placeholderTextColor="#6B7280"
              autoCapitalize="none"
              keyboardType="email-address"
              className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
            />
            <TouchableOpacity
              onPress={addEmail}
              disabled={busy}
              activeOpacity={0.85}
              className="flex-row items-center gap-1 rounded-2xl px-4"
              style={{ backgroundColor: primaryColor }}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text className="text-[13px] font-semibold text-white">Add</Text>
            </TouchableOpacity>
          </View>

          {(config?.emails ?? []).length === 0 ? (
            <Text className="mt-4 text-center text-[13px] text-muted-foreground">
              No developer emails configured.
            </Text>
          ) : (
            (config?.emails ?? []).map((email) => (
              <View
                key={email}
                className="mt-2 flex-row items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
              >
                <View className="flex-row items-center gap-2">
                  <Ionicons name="mail-outline" size={16} color={iconColor} />
                  <Text className="text-[14px] text-foreground">{email}</Text>
                </View>
                <TouchableOpacity onPress={() => removeEmail(email)} disabled={busy}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
