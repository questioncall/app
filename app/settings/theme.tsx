import { useEffect, useState } from "react";
import {
  Appearance,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { useAppTheme } from "@/hooks/use-app-theme";

type ThemePref = "system" | "light" | "dark";
const STORAGE_KEY = "theme_preference";

const OPTIONS: { key: ThemePref; label: string; subtitle: string; icon: string }[] = [
  {
    key: "system",
    label: "System Default",
    subtitle: "Follows your device setting",
    icon: "phone-portrait-outline",
  },
  {
    key: "light",
    label: "Light",
    subtitle: "Always use light mode",
    icon: "sunny-outline",
  },
  { key: "dark", label: "Dark", subtitle: "Always use dark mode", icon: "moon-outline" },
];

export default function ThemeScreen() {
  const {
    statusBarStyle,
    backgroundColor,
    primaryColor,
    primarySoftColor,
    borderColor,
    cardColor,
  } = useAppTheme();
  const [selected, setSelected] = useState<ThemePref>("system");

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((val) => {
        if (val === "light" || val === "dark" || val === "system") setSelected(val);
      })
      .catch(() => {});
  }, []);

  function applyTheme(pref: ThemePref) {
    setSelected(pref);
    SecureStore.setItemAsync(STORAGE_KEY, pref).catch(() => {});
    if (pref === "light") Appearance.setColorScheme("light");
    else if (pref === "dark") Appearance.setColorScheme("dark");
    else Appearance.setColorScheme(null);
  }

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />
      <View className="flex-row items-center px-4 pb-2 pt-14">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color={primaryColor} />
        </TouchableOpacity>
        <Text className="flex-1 text-2xl font-bold text-foreground">Theme</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <Text className="mb-4 text-sm text-muted-foreground">
          Choose how QuestionCall looks to you.
        </Text>

        <View className="overflow-hidden rounded-2xl border" style={{ borderColor }}>
          {OPTIONS.map((opt, idx) => {
            const isSelected = selected === opt.key;
            return (
              <View key={opt.key}>
                {idx > 0 && (
                  <View className="mx-4 h-px" style={{ backgroundColor: borderColor }} />
                )}
                <TouchableOpacity
                  onPress={() => applyTheme(opt.key)}
                  className="flex-row items-center px-4 py-4"
                  style={{ backgroundColor: isSelected ? primarySoftColor : cardColor }}
                  activeOpacity={0.7}
                >
                  <View
                    className="mr-3 h-10 w-10 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: isSelected ? primaryColor : `${primaryColor}15`,
                    }}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={20}
                      color={isSelected ? "#fff" : primaryColor}
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-base font-semibold text-foreground"
                      style={isSelected ? { color: primaryColor } : undefined}
                    >
                      {opt.label}
                    </Text>
                    <Text className="mt-0.5 text-xs text-muted-foreground">
                      {opt.subtitle}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color={primaryColor} />
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <Text className="mt-4 text-xs text-muted-foreground">
          Your preference is saved locally and restored on next launch.
        </Text>
      </ScrollView>
    </View>
  );
}
