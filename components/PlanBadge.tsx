import { View, Text, useColorScheme } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  slug: string;
  size?: "sm" | "md";
};

type Meta = {
  icon: string;
  label: string;
  bg: string;
  text: string;
  lightIcon: string;
  darkIcon: string;
};

const PLAN_META: Record<string, Meta> = {
  go: {
    icon: "flash",
    label: "GO",
    bg: "bg-amber-100 dark:bg-amber-900",
    text: "text-amber-700 dark:text-amber-200",
    lightIcon: "#d97706",
    darkIcon: "#fbbf24",
  },
  plus: {
    icon: "star",
    label: "PLUS",
    bg: "bg-violet-100 dark:bg-violet-900",
    text: "text-violet-700 dark:text-violet-200",
    lightIcon: "#7c3aed",
    darkIcon: "#a78bfa",
  },
  pro: {
    icon: "rocket",
    label: "PRO",
    bg: "bg-blue-100 dark:bg-blue-900",
    text: "text-blue-700 dark:text-blue-200",
    lightIcon: "#1d4ed8",
    darkIcon: "#60a5fa",
  },
  max: {
    icon: "diamond",
    label: "MAX",
    bg: "bg-pink-100 dark:bg-pink-900",
    text: "text-pink-700 dark:text-pink-200",
    lightIcon: "#be185d",
    darkIcon: "#f472b6",
  },
};

const FREE_META: Meta = {
  icon: "leaf-outline",
  label: "FREE",
  bg: "bg-gray-100 dark:bg-gray-800",
  text: "text-gray-500 dark:text-gray-400",
  lightIcon: "#9ca3af",
  darkIcon: "#6b7280",
};

export function PlanBadge({ slug, size = "sm" }: Props) {
  const isDark = useColorScheme() === "dark";
  const meta = PLAN_META[slug.toLowerCase()] ?? FREE_META;
  const iconColor = isDark ? meta.darkIcon : meta.lightIcon;
  const iconSize = size === "md" ? 12 : 10;
  const px = size === "md" ? "px-2.5 py-1" : "px-2 py-0.5";
  const fontSize = size === "md" ? "text-xs" : "text-[10px]";

  return (
    <View className={`flex-row items-center gap-1 rounded-full ${px} ${meta.bg}`}>
      <Ionicons name={meta.icon as any} size={iconSize} color={iconColor} />
      <Text className={`${fontSize} font-bold tracking-wide ${meta.text}`}>
        {meta.label}
      </Text>
    </View>
  );
}
