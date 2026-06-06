import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
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

type KeySlot = {
  _id?: string;
  maskedKey: string;
  label?: string;
  status: "ACTIVE" | "RESETTING" | "EXHAUSTED" | string;
  isExhausted: boolean;
  lastUsedAt?: string | null;
  resetAt?: string | null;
};

type AIKeysData = {
  providerOrder: string[];
  [provider: string]: unknown;
};

const STATUS_META: Record<string, { color: string; bg: string }> = {
  ACTIVE: { color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  RESETTING: { color: "#D97706", bg: "rgba(217,119,6,0.12)" },
  EXHAUSTED: { color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
};

export default function AdminAIKeysScreen() {
  const insets = useSafeAreaInsets();
  const { statusBarStyle, backgroundColor, iconColor, primaryColor } = useAppTheme();

  const [data, setData] = useState<AIKeysData | null>(
    () => readCache<AIKeysData>("ai-keys") ?? null,
  );
  const [loading, setLoading] = useState(() => readCache("ai-keys") === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { key: string; label: string }>>(
    {},
  );

  const load = useCallback(async () => {
    try {
      const res = await api.get("/mobile/admin/ai-keys");
      setData(res.data ?? null);
      writeCache("ai-keys", res.data ?? null);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to load AI keys",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial / revalidating load.
  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (body: Record<string, unknown>, method: "post" | "patch") => {
      setBusy(true);
      try {
        await (method === "patch"
          ? api.patch("/mobile/admin/ai-keys", body)
          : api.post("/mobile/admin/ai-keys", body));
        await load();
      } catch (err) {
        Toast.show({
          type: "error",
          text1: "Action failed",
          text2: getRequestErrorMessage(err, "Please try again."),
          position: "bottom",
        });
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const reorder = useCallback(
    (index: number, dir: -1 | 1) => {
      if (!data) return;
      const order = [...data.providerOrder];
      const target = index + dir;
      if (target < 0 || target >= order.length) return;
      [order[index], order[target]] = [order[target], order[index]];
      void act({ providerOrder: order }, "patch");
    },
    [data, act],
  );

  const addKey = useCallback(
    (provider: string) => {
      const draft = drafts[provider];
      if (!draft?.key?.trim()) {
        Toast.show({ type: "error", text1: "API key is required", position: "bottom" });
        return;
      }
      void act(
        {
          action: "add",
          provider,
          key: draft.key.trim(),
          label: draft.label?.trim() || undefined,
        },
        "post",
      ).then(() => setDrafts((d) => ({ ...d, [provider]: { key: "", label: "" } })));
    },
    [drafts, act],
  );

  const deleteKey = useCallback(
    (provider: string, keyIndex: number) => {
      Alert.alert("Delete key?", "This API key will be removed.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void act({ action: "delete", provider, keyIndex }, "post"),
        },
      ]);
    },
    [act],
  );

  const resetKey = useCallback(
    (provider: string, keyIndex: number) =>
      void act({ action: "reset", provider, keyIndex }, "post"),
    [act],
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
              AI Keys
            </Text>
            <Text className="text-[12px] text-muted-foreground">
              Failover priority — top provider is used first
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
          {(data?.providerOrder ?? []).map((provider, index) => {
            const keys = (data?.[provider] as KeySlot[]) ?? [];
            const draft = drafts[provider] ?? { key: "", label: "" };
            return (
              <View
                key={provider}
                className="mb-4 rounded-2xl border border-border bg-card p-4"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View
                      className="h-6 w-6 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${primaryColor}1A` }}
                    >
                      <Text
                        className="text-[11px] font-bold"
                        style={{ color: primaryColor }}
                      >
                        {index + 1}
                      </Text>
                    </View>
                    <Text className="text-[15px] font-semibold capitalize text-foreground">
                      {provider}
                    </Text>
                    <Text className="text-[12px] text-muted-foreground">
                      ({keys.length})
                    </Text>
                  </View>
                  <View className="flex-row gap-1">
                    <TouchableOpacity
                      disabled={busy || index === 0}
                      onPress={() => reorder(index, -1)}
                      className="h-8 w-8 items-center justify-center rounded-full border border-border"
                      style={{ opacity: index === 0 ? 0.4 : 1 }}
                    >
                      <Ionicons name="chevron-up" size={16} color={iconColor} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={busy || index === (data?.providerOrder.length ?? 0) - 1}
                      onPress={() => reorder(index, 1)}
                      className="h-8 w-8 items-center justify-center rounded-full border border-border"
                      style={{
                        opacity:
                          index === (data?.providerOrder.length ?? 0) - 1 ? 0.4 : 1,
                      }}
                    >
                      <Ionicons name="chevron-down" size={16} color={iconColor} />
                    </TouchableOpacity>
                  </View>
                </View>

                {keys.length === 0 ? (
                  <Text className="mt-3 text-[12px] text-muted-foreground">
                    No keys configured.
                  </Text>
                ) : (
                  keys.map((k, idx) => {
                    const meta = STATUS_META[k.status] ?? {
                      color: iconColor,
                      bg: "rgba(120,120,120,0.12)",
                    };
                    return (
                      <View
                        key={k._id ?? idx}
                        className="mt-3 rounded-xl border border-border p-3"
                      >
                        <View className="flex-row items-center justify-between">
                          <Text className="font-mono text-[13px] text-foreground">
                            {k.maskedKey}
                          </Text>
                          <View
                            className="rounded-full px-2 py-0.5"
                            style={{ backgroundColor: meta.bg }}
                          >
                            <Text
                              className="text-[10px] font-bold"
                              style={{ color: meta.color }}
                            >
                              {k.status}
                            </Text>
                          </View>
                        </View>
                        {k.label ? (
                          <Text className="mt-1 text-[11px] text-muted-foreground">
                            🏷️ {k.label}
                          </Text>
                        ) : null}
                        <View className="mt-2 flex-row gap-2">
                          {k.isExhausted ? (
                            <TouchableOpacity
                              disabled={busy}
                              onPress={() => resetKey(provider, idx)}
                              className="flex-row items-center gap-1 rounded-full border border-border px-3 py-1.5"
                              activeOpacity={0.85}
                            >
                              <Ionicons name="refresh" size={13} color={iconColor} />
                              <Text className="text-[12px] font-semibold text-foreground">
                                Reset
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                          <TouchableOpacity
                            disabled={busy}
                            onPress={() => deleteKey(provider, idx)}
                            className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
                            style={{ backgroundColor: "rgba(239,68,68,0.12)" }}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="trash-outline" size={13} color="#EF4444" />
                            <Text
                              className="text-[12px] font-semibold"
                              style={{ color: "#EF4444" }}
                            >
                              Delete
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}

                {/* Add key */}
                <View className="mt-3 gap-2 rounded-xl border border-dashed border-border p-3">
                  <TextInput
                    value={draft.key}
                    onChangeText={(text) =>
                      setDrafts((d) => ({ ...d, [provider]: { ...draft, key: text } }))
                    }
                    placeholder="sk-..."
                    placeholderTextColor="#6B7280"
                    autoCapitalize="none"
                    className="rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-[13px] text-foreground"
                  />
                  <View className="flex-row gap-2">
                    <TextInput
                      value={draft.label}
                      onChangeText={(text) =>
                        setDrafts((d) => ({
                          ...d,
                          [provider]: { ...draft, label: text },
                        }))
                      }
                      placeholder="Label (optional)"
                      placeholderTextColor="#6B7280"
                      className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] text-foreground"
                    />
                    <TouchableOpacity
                      disabled={busy}
                      onPress={() => addKey(provider)}
                      className="flex-row items-center gap-1 rounded-xl px-4"
                      style={{ backgroundColor: primaryColor }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="add" size={16} color="#fff" />
                      <Text className="text-[13px] font-semibold text-white">Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
