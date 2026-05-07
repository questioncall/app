import type { ComponentProps } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/use-app-theme";

type AuthNoticeTone = "error" | "success" | "info";

type AuthNoticeProps = {
  message?: string | null;
  tone?: AuthNoticeTone;
};

const toneStyles: Record<AuthNoticeTone, string> = {
  error: "border-rose-500/25 bg-rose-500/10",
  success: "border-emerald-500/25 bg-emerald-500/10",
  info: "border-sky-500/25 bg-sky-500/10",
};

const toneIcons: Record<AuthNoticeTone, string> = {
  error: "alert-circle-outline",
  success: "checkmark-circle-outline",
  info: "information-circle-outline",
};

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export function AuthNotice({ message, tone = "error" }: AuthNoticeProps) {
  const { isDark } = useAppTheme();

  if (!message) {
    return null;
  }

  const accentColor =
    tone === "error"
      ? isDark
        ? "#FDA4AF"
        : "#E11D48"
      : tone === "success"
        ? isDark
          ? "#6EE7B7"
          : "#059669"
        : isDark
          ? "#7DD3FC"
          : "#0284C7";

  return (
    <View
      className={`mt-1 flex-row items-start gap-3 rounded-2xl border px-4 py-3 ${toneStyles[tone]}`}
    >
      <Ionicons
        name={toneIcons[tone] as IoniconName}
        size={18}
        color={accentColor}
        style={{ marginTop: 1 }}
      />
      <Text
        className="flex-1 text-sm font-medium leading-5"
        style={{ color: accentColor }}
      >
        {message}
      </Text>
    </View>
  );
}
