import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  StatusBar,
  type KeyboardTypeOptions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/hooks/use-app-theme";
import { api } from "@/lib/api";
import { getRequestErrorMessage } from "@/lib/server-response";
import { readCache, writeCache } from "@/lib/admin-cache";

export type PlatformConfig = Record<string, any>;

/**
 * Shared loader for every config-style admin tab (Social, Subscription,
 * Format, Onboarding, Settings, Legal, Payment Config). All of them read and
 * write the single `PlatformConfig` document via `/mobile/admin/config`, so we
 * seed instantly from the prefetched `config` cache, revalidate on mount, and
 * keep the cache warm after each save.
 */
export function useAdminConfig() {
  const seed = readCache<PlatformConfig>("config");
  const [config, setConfig] = useState<PlatformConfig | undefined>(seed);
  const [loading, setLoading] = useState(() => seed === undefined);

  const reload = useCallback(async () => {
    try {
      const res = await api.get("/mobile/admin/config");
      const data = (res.data ?? {}) as PlatformConfig;
      writeCache("config", data);
      setConfig(data);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to load config",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** PUT a partial update; returns true on success and refreshes the cache. */
  const save = useCallback(async (patch: PlatformConfig): Promise<boolean> => {
    try {
      const res = await api.put("/mobile/admin/config", patch);
      const data = (res.data ?? {}) as PlatformConfig;
      writeCache("config", data);
      setConfig(data);
      Toast.show({ type: "success", text1: "Saved", position: "bottom" });
      return true;
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to save",
        text2: getRequestErrorMessage(err, "Please try again."),
        position: "bottom",
      });
      return false;
    }
  }, []);

  return { config, loading, reload, save };
}

/**
 * Hydrate local form state from the config document exactly once — when the
 * config first becomes available — so a background revalidate never clobbers
 * what the admin is editing.
 */
export function useHydrateFromConfig(
  config: PlatformConfig | undefined,
  hydrate: (config: PlatformConfig) => void,
) {
  const done = useRef(false);
  useEffect(() => {
    if (!done.current && config) {
      hydrate(config);
      done.current = true;
    }
    // `hydrate` is expected to be a stable derive function defined per screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);
}

/** Header + scrollable body + sticky save button used by every config tab. */
export function ConfigScreenShell({
  title,
  loading,
  saving,
  onSave,
  saveLabel = "Save changes",
  children,
}: {
  title: string;
  loading: boolean;
  saving: boolean;
  onSave: () => void;
  saveLabel?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { statusBarStyle, backgroundColor, iconColor, primaryColor } = useAppTheme();

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
            {title}
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
          {children}

          <TouchableOpacity
            onPress={onSave}
            disabled={saving}
            activeOpacity={0.85}
            className="mt-7 items-center rounded-full py-4"
            style={{ backgroundColor: primaryColor }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-[15px] font-semibold text-white">{saveLabel}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

/** Labelled single-line text/number field. */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View className="mt-4">
      <Text className="mb-1 ml-1 text-[13px] font-semibold text-foreground">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6B7280"
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
        style={multiline ? { minHeight: 120, textAlignVertical: "top" } : undefined}
      />
    </View>
  );
}

/** A row of labelled numeric fields laid out two-per-row. */
export function NumberGrid({
  fields,
}: {
  fields: { label: string; value: string; onChangeText: (t: string) => void }[];
}) {
  return (
    <View className="mt-2 flex-row flex-wrap justify-between">
      {fields.map((f) => (
        <View key={f.label} className="mt-3 w-[48%]">
          <Text className="mb-1 ml-1 text-[12px] font-medium text-muted-foreground">
            {f.label}
          </Text>
          <TextInput
            value={f.value}
            onChangeText={f.onChangeText}
            keyboardType="numeric"
            placeholderTextColor="#6B7280"
            className="rounded-2xl border border-border bg-background px-4 py-3 text-[14px] text-foreground"
          />
        </View>
      ))}
    </View>
  );
}

/** Labelled on/off row. */
export function SwitchRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  const { primaryColor } = useAppTheme();
  return (
    <View className="mt-5 flex-row items-center justify-between">
      <Text className="flex-1 pr-3 text-[14px] font-medium text-foreground">{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: primaryColor }}
      />
    </View>
  );
}

/** Section heading inside a config form. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text className="mb-1 ml-1 mt-7 text-xs font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </Text>
  );
}
