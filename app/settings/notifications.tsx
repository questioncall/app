import { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { useAppTheme } from "@/hooks/use-app-theme";

const STORAGE_KEY = "notification_prefs";

interface NotifPrefs {
  newQuestion: boolean;
  questionAccepted: boolean;
  newMessage: boolean;
  withdrawal: boolean;
  subscription: boolean;
  monthlyBonus: boolean;
  dailyTarget: boolean;
  announcements: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  newQuestion: true,
  questionAccepted: true,
  newMessage: true,
  withdrawal: true,
  subscription: true,
  monthlyBonus: true,
  dailyTarget: true,
  announcements: true,
};

export default function NotificationsScreen() {
  const { statusBarStyle, backgroundColor, primaryColor, borderColor } = useAppTheme();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((raw) => {
        if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
      })
      .catch(() => {});
  }, []);

  const toggle = useCallback(
    (key: keyof NotifPrefs) => (value: boolean) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: value };
        SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [],
  );

  function Row({
    icon,
    label,
    subtitle,
    value,
    onToggle,
  }: {
    icon: string;
    label: string;
    subtitle: string;
    value: boolean;
    onToggle: (v: boolean) => void;
  }) {
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
        <Switch
          value={value}
          onValueChange={onToggle}
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="px-4 pb-2 pt-5">
          <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Questions
          </Text>
        </View>
        <View className="mx-4 overflow-hidden rounded-2xl border" style={{ borderColor }}>
          <Row
            icon="help-circle-outline"
            label="New Question"
            subtitle="When a student posts a question"
            value={prefs.newQuestion}
            onToggle={toggle("newQuestion")}
          />
          <Divider />
          <Row
            icon="checkmark-circle-outline"
            label="Question Accepted"
            subtitle="When a teacher accepts your question"
            value={prefs.questionAccepted}
            onToggle={toggle("questionAccepted")}
          />
        </View>

        <View className="px-4 pb-2 pt-5">
          <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Chat
          </Text>
        </View>
        <View className="mx-4 overflow-hidden rounded-2xl border" style={{ borderColor }}>
          <Row
            icon="chatbubble-outline"
            label="New Message"
            subtitle="When you receive a chat message"
            value={prefs.newMessage}
            onToggle={toggle("newMessage")}
          />
        </View>

        <View className="px-4 pb-2 pt-5">
          <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Wallet
          </Text>
        </View>
        <View className="mx-4 overflow-hidden rounded-2xl border" style={{ borderColor }}>
          <Row
            icon="cash-outline"
            label="Withdrawal Processed"
            subtitle="When your withdrawal is approved"
            value={prefs.withdrawal}
            onToggle={toggle("withdrawal")}
          />
          <Divider />
          <Row
            icon="gift-outline"
            label="Monthly Bonus"
            subtitle="Your monthly point bonus has arrived"
            value={prefs.monthlyBonus}
            onToggle={toggle("monthlyBonus")}
          />
          <Divider />
          <Row
            icon="trophy-outline"
            label="Daily Target"
            subtitle="Reminders to hit your daily answer goal"
            value={prefs.dailyTarget}
            onToggle={toggle("dailyTarget")}
          />
        </View>

        <View className="px-4 pb-2 pt-5">
          <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Account
          </Text>
        </View>
        <View className="mx-4 overflow-hidden rounded-2xl border" style={{ borderColor }}>
          <Row
            icon="diamond-outline"
            label="Subscription Activated"
            subtitle="When your plan upgrade is confirmed"
            value={prefs.subscription}
            onToggle={toggle("subscription")}
          />
          <Divider />
          <Row
            icon="megaphone-outline"
            label="Announcements"
            subtitle="Platform notices and updates"
            value={prefs.announcements}
            onToggle={toggle("announcements")}
          />
        </View>

        <Text className="mx-4 mt-4 text-xs text-muted-foreground">
          Preferences saved locally. Push notifications delivered via FCM.
        </Text>
      </ScrollView>
    </View>
  );
}
