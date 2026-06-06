import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/hooks/use-app-theme";
import { api, SECURE_STORE_KEYS } from "@/lib/api";

type ReceiptType = "subscription" | "course";
type Gateway = "esewa" | "manual";

const PLANS = [
  { slug: "go", label: "GO", amount: "499", validDays: 30 },
  { slug: "plus", label: "PLUS", amount: "799", validDays: 60 },
  { slug: "pro", label: "PRO", amount: "999", validDays: 90 },
  { slug: "max", label: "MAX", amount: "1499", validDays: 120 },
] as const;

const COURSES = [
  { name: "Photoshop Masterclass", amount: "1499" },
  { name: "Beginner Python", amount: "999" },
  { name: "Pro Video Editing", amount: "2499" },
] as const;

const SAMPLE_EMAIL = "user@example.com";

function Toggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { primaryColor, iconColor } = useAppTheme();
  return (
    <View className="flex-row gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.85}
            className="flex-1 items-center rounded-2xl border px-3 py-2.5"
            style={{
              borderColor: active ? primaryColor : "transparent",
              backgroundColor: active ? `${primaryColor}1A` : "rgba(120,120,120,0.1)",
            }}
          >
            <Text
              className="text-[13px] font-semibold"
              style={{ color: active ? primaryColor : iconColor }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * Receipt template preview. Mirrors the web Receipts tool: pick a flow and
 * plan/course, then open the exact server-generated PDF that gets emailed to
 * users. The PDF is opened in the device browser via a token-authenticated
 * mobile preview route (a browser can't send a bearer header).
 */
export default function AdminReceiptsScreen() {
  const insets = useSafeAreaInsets();
  const { statusBarStyle, backgroundColor, iconColor, primaryColor } = useAppTheme();

  const [type, setType] = useState<ReceiptType>("subscription");
  const [gateway, setGateway] = useState<Gateway>("esewa");
  const [planIdx, setPlanIdx] = useState(2); // PRO
  const [courseIdx, setCourseIdx] = useState(0);
  const [opening, setOpening] = useState(false);

  const selectedPlan = PLANS[planIdx];
  const selectedCourse = COURSES[courseIdx];

  const params = useMemo(() => {
    const p = new URLSearchParams({ type, gateway, email: SAMPLE_EMAIL });
    if (type === "subscription") {
      p.set("planSlug", selectedPlan.slug);
      p.set("amount", selectedPlan.amount);
      p.set("validDays", String(selectedPlan.validDays));
    } else {
      p.set("courseName", selectedCourse.name);
      p.set("amount", selectedCourse.amount);
    }
    return p;
  }, [type, gateway, selectedPlan, selectedCourse]);

  const openPreview = useCallback(async () => {
    setOpening(true);
    try {
      const token = await SecureStore.getItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
      if (!token) {
        Toast.show({ type: "error", text1: "Session expired", position: "bottom" });
        return;
      }
      const base = api.defaults.baseURL?.replace(/\/$/, "") ?? "";
      const query = new URLSearchParams(params);
      query.set("token", token);
      await WebBrowser.openBrowserAsync(
        `${base}/mobile/admin/receipts/preview?${query.toString()}`,
      );
    } catch {
      Toast.show({ type: "error", text1: "Could not open preview", position: "bottom" });
    } finally {
      setOpening(false);
    }
  }, [params]);

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
              Receipts
            </Text>
            <Text className="text-[12px] text-muted-foreground">
              Preview emailed PDFs
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom + 32, 40),
        }}
      >
        <View className="rounded-2xl border border-border bg-card p-4">
          <Text className="text-[13px] text-muted-foreground">
            Receipts are auto-generated and emailed when a subscription or course payment
            is approved (manual) or auto-verified (eSewa). Withdrawals send a push only —
            no PDF.
          </Text>
        </View>

        <Text className="mb-2 ml-1 mt-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Flow
        </Text>
        <Toggle
          value={type}
          onChange={setType}
          options={[
            { value: "subscription", label: "Subscription" },
            { value: "course", label: "Course" },
          ]}
        />

        <Text className="mb-2 ml-1 mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Gateway
        </Text>
        <Toggle
          value={gateway}
          onChange={setGateway}
          options={[
            { value: "esewa", label: "eSewa (auto)" },
            { value: "manual", label: "Manual" },
          ]}
        />

        <Text className="mb-2 ml-1 mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {type === "subscription" ? "Plan" : "Course"}
        </Text>
        {type === "subscription"
          ? PLANS.map((plan, idx) => {
              const active = idx === planIdx;
              return (
                <TouchableOpacity
                  key={plan.slug}
                  onPress={() => setPlanIdx(idx)}
                  activeOpacity={0.85}
                  className="mb-2 flex-row items-center justify-between rounded-2xl border p-4"
                  style={{
                    borderColor: active ? primaryColor : "rgba(120,120,120,0.2)",
                    backgroundColor: active ? `${primaryColor}1A` : "transparent",
                  }}
                >
                  <View>
                    <Text className="text-[14px] font-semibold text-foreground">
                      {plan.label}
                    </Text>
                    <Text className="text-[12px] text-muted-foreground">
                      Valid {plan.validDays} days
                    </Text>
                  </View>
                  <Text className="text-[14px] font-bold" style={{ color: "#10B981" }}>
                    NPR {plan.amount}
                  </Text>
                </TouchableOpacity>
              );
            })
          : COURSES.map((course, idx) => {
              const active = idx === courseIdx;
              return (
                <TouchableOpacity
                  key={course.name}
                  onPress={() => setCourseIdx(idx)}
                  activeOpacity={0.85}
                  className="mb-2 flex-row items-center justify-between rounded-2xl border p-4"
                  style={{
                    borderColor: active ? primaryColor : "rgba(120,120,120,0.2)",
                    backgroundColor: active ? `${primaryColor}1A` : "transparent",
                  }}
                >
                  <Text className="flex-1 pr-3 text-[14px] font-semibold text-foreground">
                    {course.name}
                  </Text>
                  <Text className="text-[14px] font-bold" style={{ color: "#10B981" }}>
                    NPR {course.amount}
                  </Text>
                </TouchableOpacity>
              );
            })}

        <TouchableOpacity
          onPress={openPreview}
          disabled={opening}
          activeOpacity={0.85}
          className="mt-6 flex-row items-center justify-center gap-2 rounded-full py-4"
          style={{ backgroundColor: primaryColor }}
        >
          {opening ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="document-text-outline" size={18} color="#fff" />
              <Text className="text-[15px] font-semibold text-white">
                Open PDF preview
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
