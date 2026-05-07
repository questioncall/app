import { DarkTheme, DefaultTheme } from "@react-navigation/native";
import { useColorScheme } from "react-native";

export function useAppTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return {
    colorScheme,
    isDark,
    navigationTheme: isDark ? DarkTheme : DefaultTheme,
    statusBarStyle: isDark ? ("light-content" as const) : ("dark-content" as const),
    backgroundColor: isDark ? "#1c1917" : "#FFFFFF",
    cardColor: isDark ? "#292524" : "#FFFFFF",
    iconColor: isDark ? "#FFFFFF" : "#111111",
    mutedIconColor: isDark ? "#D6D3D1" : "#57534E",
  };
}
