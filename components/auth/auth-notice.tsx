import type { ComponentProps } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type AuthNoticeTone = "error" | "success" | "info";

type AuthNoticeProps = {
  message?: string | null;
  tone?: AuthNoticeTone;
};

const toneStyles: Record<AuthNoticeTone, string> = {
  error: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-200",
  success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  info: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-200",
};

const toneIcons: Record<AuthNoticeTone, string> = {
  error: "alert-circle-outline",
  success: "checkmark-circle-outline",
  info: "information-circle-outline",
};

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export function AuthNotice({ message, tone = "error" }: AuthNoticeProps) {
  if (!message) {
    return null;
  }

  return (
    <View
      className={`mt-1 flex-row items-start gap-3 rounded-2xl border px-4 py-3 ${toneStyles[tone]}`}
    >
      <Ionicons
        name={toneIcons[tone] as IoniconName}
        size={18}
        color={tone === "error" ? "#E11D48" : tone === "success" ? "#059669" : "#0284C7"}
        style={{ marginTop: 1 }}
      />
      <Text className="flex-1 text-sm font-medium leading-5">{message}</Text>
    </View>
  );
}
