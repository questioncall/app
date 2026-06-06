import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  RefreshControl,
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

type UserRef = { name?: string; username?: string } | null;

type SecurityData = {
  config: {
    antiCheatEnabled: boolean;
    antiCheatConsecutiveThreshold: number;
    antiCheatSuspensionDays: number;
  };
  alerts: {
    _id: string;
    teacherId: UserRef;
    studentId: UserRef;
    consecutiveCount: number;
    createdAt: string;
  }[];
  matrix: { teacher: UserRef; student: UserRef; count: number; lastAt?: string | null }[];
};

function timeAgo(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminSecurityScreen() {
  const insets = useSafeAreaInsets();
  const { statusBarStyle, backgroundColor, iconColor, primaryColor } = useAppTheme();

  const seed = readCache<SecurityData>("security");
  const [data, setData] = useState<SecurityData | null>(seed ?? null);
  const [loading, setLoading] = useState(() => seed === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [enabled, setEnabled] = useState(seed?.config.antiCheatEnabled ?? true);
  const [threshold, setThreshold] = useState(
    String(seed?.config.antiCheatConsecutiveThreshold ?? 5),
  );
  const [suspensionDays, setSuspensionDays] = useState(
    String(seed?.config.antiCheatSuspensionDays ?? 3),
  );

  const load = useCallback(async () => {
    try {
      const res = await api.get("/mobile/admin/security");
      const d = res.data as SecurityData;
      setData(d);
      setEnabled(d.config.antiCheatEnabled);
      setThreshold(String(d.config.antiCheatConsecutiveThreshold));
      setSuspensionDays(String(d.config.antiCheatSuspensionDays));
      writeCache("security", d);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to load security data",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveConfig = useCallback(async () => {
    setSaving(true);
    try {
      await api.post("/mobile/admin/security", {
        antiCheatEnabled: enabled,
        antiCheatConsecutiveThreshold: Number(threshold) || 2,
        antiCheatSuspensionDays: Number(suspensionDays) || 1,
      });
      Toast.show({
        type: "success",
        text1: "Security config updated",
        position: "bottom",
      });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to save",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setSaving(false);
    }
  }, [enabled, threshold, suspensionDays]);

  const dismissAlert = (id: string) =>
    setData((prev) =>
      prev ? { ...prev, alerts: prev.alerts.filter((a) => a._id !== id) } : prev,
    );

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
          <View>
            <Text className="text-[18px] font-bold tracking-tight text-foreground">
              Security
            </Text>
            <Text className="text-[12px] text-muted-foreground">
              Anti-cheat & collusion
            </Text>
          </View>
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
        >
          {/* Config */}
          <View className="rounded-2xl border border-border bg-card p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-[14px] font-semibold text-foreground">
                  Enable detection
                </Text>
                <Text className="text-[12px] text-muted-foreground">
                  Monitor and warn on collusive behavior
                </Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                trackColor={{ true: primaryColor }}
              />
            </View>

            <Text className="mb-1 mt-4 text-[12px] font-medium text-foreground">
              Consecutive questions threshold
            </Text>
            <TextInput
              value={threshold}
              onChangeText={setThreshold}
              keyboardType="numeric"
              placeholderTextColor="#6B7280"
              className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
            />

            <Text className="mb-1 mt-4 text-[12px] font-medium text-foreground">
              Suspension duration (days)
            </Text>
            <TextInput
              value={suspensionDays}
              onChangeText={setSuspensionDays}
              keyboardType="numeric"
              placeholderTextColor="#6B7280"
              className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
            />

            <TouchableOpacity
              onPress={saveConfig}
              disabled={saving}
              activeOpacity={0.85}
              className="mt-4 items-center rounded-full py-3.5"
              style={{ backgroundColor: primaryColor }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-[14px] font-semibold text-white">
                  Save configuration
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Alerts */}
          <Text className="mb-2 ml-1 mt-7 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Recent alerts
          </Text>
          {(data?.alerts ?? []).length === 0 ? (
            <View className="items-center rounded-2xl border border-border bg-card py-8">
              <Ionicons name="shield-checkmark-outline" size={32} color="#10B981" />
              <Text className="mt-2 text-[13px] text-muted-foreground">
                No cheating alerts.
              </Text>
            </View>
          ) : (
            (data?.alerts ?? []).map((alert) => (
              <View
                key={alert._id}
                className="mb-3 rounded-2xl border border-border bg-card p-4"
              >
                <View className="flex-row items-center justify-between">
                  <Text
                    className="text-[13px] font-semibold"
                    style={{ color: "#D97706" }}
                  >
                    {alert.consecutiveCount} consecutive
                  </Text>
                  <TouchableOpacity onPress={() => dismissAlert(alert._id)}>
                    <Text className="text-[12px] font-semibold text-muted-foreground">
                      Dismiss
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text className="mt-2 text-[13px] text-foreground">
                  Teacher: {alert.teacherId?.name ?? "Unknown"}
                  {alert.teacherId?.username ? ` (@${alert.teacherId.username})` : ""}
                </Text>
                <Text className="text-[13px] text-foreground">
                  Student: {alert.studentId?.name ?? "Unknown"}
                  {alert.studentId?.username ? ` (@${alert.studentId.username})` : ""}
                </Text>
                <Text className="mt-1 text-[11px] text-muted-foreground">
                  {timeAgo(alert.createdAt)}
                </Text>
              </View>
            ))
          )}

          {/* Frequency matrix */}
          <Text className="mb-2 ml-1 mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Frequency matrix
          </Text>
          {(data?.matrix ?? []).length === 0 ? (
            <Text className="text-center text-[13px] text-muted-foreground">
              No activity data available.
            </Text>
          ) : (
            (data?.matrix ?? []).map((row, i) => (
              <View
                key={i}
                className="mb-2 flex-row items-center justify-between rounded-2xl border border-border bg-card p-4"
              >
                <View className="flex-1 pr-3">
                  <Text className="text-[13px] font-medium text-foreground">
                    {row.teacher?.name ?? "Unknown teacher"} →{" "}
                    {row.student?.name ?? "Unknown student"}
                  </Text>
                  <Text className="text-[11px] text-muted-foreground">
                    {timeAgo(row.lastAt)}
                  </Text>
                </View>
                <View
                  className="rounded-full px-2.5 py-0.5"
                  style={{ backgroundColor: `${primaryColor}1A` }}
                >
                  <Text className="text-[13px] font-bold" style={{ color: primaryColor }}>
                    {row.count}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
