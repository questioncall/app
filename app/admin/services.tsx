import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ComponentProps } from "react";

import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";
import { getRequestErrorMessage } from "@/lib/server-response";
import { readCache, writeCache } from "@/lib/admin-cache";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type UsageMetric = {
  label: string;
  value: number;
  max: number;
  unit: string;
  percentage: number;
};

type ServiceDetail = {
  id: string;
  name: string;
  icon: string;
  status: "healthy" | "warning" | "error" | string;
  summary: string;
  usage: UsageMetric[];
  lastUpdated: string;
};

const ICON_MAP: Record<string, IoniconName> = {
  Video: "videocam-outline",
  Cloud: "cloud-outline",
  Mail: "mail-outline",
  Cpu: "hardware-chip-outline",
  Database: "server-outline",
  CreditCard: "card-outline",
};

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  healthy: { color: "#10B981", bg: "rgba(16,185,129,0.12)", label: "Healthy" },
  warning: { color: "#D97706", bg: "rgba(217,119,6,0.12)", label: "Warning" },
  error: { color: "#EF4444", bg: "rgba(239,68,68,0.12)", label: "Down" },
};

export default function AdminServicesScreen() {
  const insets = useSafeAreaInsets();
  const { statusBarStyle, backgroundColor, iconColor, primaryColor } = useAppTheme();

  const [services, setServices] = useState<ServiceDetail[]>(
    () => readCache<ServiceDetail[]>("services") ?? [],
  );
  const [loading, setLoading] = useState(() => readCache("services") === undefined);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/mobile/admin/services");
      const data = Array.isArray(res.data?.services) ? res.data.services : [];
      setServices(data);
      writeCache("services", data);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to load services",
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
            Services
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
            paddingBottom: Math.max(insets.bottom + 24, 32),
          }}
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
          {services.map((service) => {
            const status = STATUS_META[service.status] ?? {
              color: iconColor,
              bg: "rgba(120,120,120,0.12)",
              label: service.status,
            };
            return (
              <View
                key={service.id}
                className="mb-3 rounded-2xl border border-border bg-card p-4"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <View
                      className="h-10 w-10 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${primaryColor}14` }}
                    >
                      <Ionicons
                        name={ICON_MAP[service.icon] ?? "ellipse-outline"}
                        size={20}
                        color={primaryColor}
                      />
                    </View>
                    <View>
                      <Text className="text-[15px] font-semibold text-foreground">
                        {service.name}
                      </Text>
                      <Text
                        className="text-[12px] text-muted-foreground"
                        numberOfLines={1}
                      >
                        {service.summary}
                      </Text>
                    </View>
                  </View>
                  <View
                    className="rounded-full px-2 py-0.5"
                    style={{ backgroundColor: status.bg }}
                  >
                    <Text
                      className="text-[11px] font-bold"
                      style={{ color: status.color }}
                    >
                      {status.label}
                    </Text>
                  </View>
                </View>

                {service.usage.length > 0 ? (
                  <View className="mt-3 gap-2.5">
                    {service.usage.map((metric) => (
                      <View key={metric.label}>
                        <View className="flex-row items-center justify-between">
                          <Text className="text-[12px] text-muted-foreground">
                            {metric.label}
                          </Text>
                          <Text className="text-[12px] font-medium text-foreground">
                            {metric.value} / {metric.max} {metric.unit}
                          </Text>
                        </View>
                        <View
                          className="bg-muted/40 mt-1 h-1.5 overflow-hidden rounded-full"
                          style={{ backgroundColor: "rgba(120,120,120,0.18)" }}
                        >
                          <View
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, Math.max(0, metric.percentage))}%`,
                              backgroundColor: status.color,
                            }}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
