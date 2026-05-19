import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Toast from "react-native-toast-message";

import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";

// ─── Shape — must match web/lib/notification-prefs.ts ──────────────────────
// Four categories cover every backend NOTIFICATION_TYPES enum value.
// Calls live in /settings/call-settings (callSettings.silentIncomingCalls).
type NotifPrefs = {
  questions: boolean;
  chat: boolean;
  wallet: boolean;
  announcements: boolean;
};

const DEFAULT_PREFS: NotifPrefs = {
  questions: true,
  chat: true,
  wallet: true,
  announcements: true,
};

type PrefKey = keyof NotifPrefs;

const ROWS: readonly {
  key: PrefKey;
  icon: string;
  label: string;
  subtitle: string;
}[] = [
  {
    key: "questions",
    icon: "help-circle-outline",
    label: "Questions",
    subtitle: "Accepted, reset, answer submitted, deadline warnings",
  },
  {
    key: "chat",
    icon: "chatbubble-outline",
    label: "Chat",
    subtitle: "Channel closed and expired alerts",
  },
  {
    key: "wallet",
    icon: "wallet-outline",
    label: "Wallet & Rewards",
    subtitle: "Payments, ratings, monthly bonus, daily targets",
  },
  {
    key: "announcements",
    icon: "megaphone-outline",
    label: "Announcements",
    subtitle: "Platform notices and product updates",
  },
];

export default function NotificationsScreen() {
  const { statusBarStyle, backgroundColor, primaryColor, borderColor, mutedIconColor } =
    useAppTheme();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<PrefKey | null>(null);

  useEffect(() => {
    api
      .get("/users/notification-prefs")
      .then((res) => {
        if (res.data?.notificationPrefs) {
          setPrefs({ ...DEFAULT_PREFS, ...res.data.notificationPrefs });
        }
      })
      .catch((err: any) => {
        console.warn("[notifications] Failed to load prefs:", err?.message);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const toggle = useCallback(
    async (key: PrefKey, value: boolean) => {
      // Optimistic: flip locally first so the switch responds instantly.
      const previous = prefs;
      const next = { ...prefs, [key]: value };
      setPrefs(next);
      setSavingKey(key);
      try {
        await api.patch("/users/notification-prefs", next);
      } catch (err: any) {
        // Rollback on failure so the UI never lies about server state.
        setPrefs(previous);
        Toast.show({
          type: "error",
          text1: "Couldn't save preference. Please try again.",
        });
        console.warn("[notifications] Save failed:", err?.message);
      } finally {
        setSavingKey(null);
      }
    },
    [prefs],
  );

  function Row({
    rowKey,
    icon,
    label,
    subtitle,
  }: {
    rowKey: PrefKey;
    icon: string;
    label: string;
    subtitle: string;
  }) {
    const value = prefs[rowKey];
    const saving = savingKey === rowKey;
    return (
      <View className="flex-row items-center bg-card px-4 py-3.5">
        <View
          className="mr-3 h-9 w-9 items-center justify-center rounded-xl"
          style={{
            backgroundColor: value ? `${primaryColor}20` : "rgba(120,120,120,0.1)",
          }}
        >
          <Ionicons name={icon as any} size={18} color={value ? primaryColor : "#888"} />
        </View>
        <View className="mr-3 flex-1">
          <Text className="text-sm font-medium text-foreground">{label}</Text>
          <Text className="mt-0.5 text-xs text-muted-foreground">{subtitle}</Text>
        </View>
        {saving ? (
          <ActivityIndicator
            size="small"
            color={primaryColor}
            style={{ marginRight: 8 }}
          />
        ) : null}
        <Switch
          value={value}
          disabled={saving}
          onValueChange={(v) => toggle(rowKey, v)}
          trackColor={{ false: "#d1d5db", true: `${primaryColor}60` }}
          thumbColor={value ? primaryColor : "#f4f3f4"}
        />
      </View>
    );
  }

  function Divider() {
    return <View className="mx-4 h-px" style={{ backgroundColor: borderColor }} />;
  }

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
      <View className="flex-row items-center px-4 pb-2 pt-14">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color={primaryColor} />
        </TouchableOpacity>
        <Text className="flex-1 text-2xl font-bold text-foreground">Notifications</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={primaryColor} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <Text className="px-5 pb-3 pt-2 text-sm text-muted-foreground">
            Turn categories off to stop receiving push notifications. The in-app
            notification center will still show them.
          </Text>

          <View
            className="mx-4 overflow-hidden rounded-2xl border"
            style={{ borderColor }}
          >
            {ROWS.map((row, i) => (
              <View key={row.key}>
                <Row
                  rowKey={row.key}
                  icon={row.icon}
                  label={row.label}
                  subtitle={row.subtitle}
                />
                {i < ROWS.length - 1 ? <Divider /> : null}
              </View>
            ))}
          </View>

          {/* Pointer to call settings — calls live in a separate screen */}
          <TouchableOpacity
            onPress={() => router.push("/settings/call-settings" as any)}
            className="mx-4 mt-4 flex-row items-center rounded-2xl border bg-card px-4 py-3.5"
            style={{ borderColor }}
            activeOpacity={0.7}
          >
            <View
              className="mr-3 h-9 w-9 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <Ionicons name="call-outline" size={18} color={primaryColor} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-foreground">Call alerts</Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">
                Silent calls and ringtones — open Call Settings
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={mutedIconColor} />
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}
