import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { useAppTheme } from "@/hooks/use-app-theme";
import { persistor, resetStore } from "@/store";
import { SECURE_STORE_KEYS } from "@/lib/api";
import { resetPusherClient } from "@/lib/realtime";
import { clearAdminCache } from "@/lib/admin-cache";
import { getCurrentPushToken, unsubscribePushToken } from "@/lib/push-notifications";
import {
  ADMIN_SECTION_GROUPS,
  ADMIN_SECTION_COUNT,
  type AdminSection,
} from "@/lib/admin-portal";

function SectionCard({ section }: { section: AdminSection }) {
  const { primaryColor, primarySoftColor, mutedIconColor } = useAppTheme();

  function handlePress() {
    if (section.ready) {
      router.push(section.href);
      return;
    }
    Toast.show({
      type: "info",
      text1: `${section.label}`,
      text2: "Coming soon to mobile admin.",
      position: "bottom",
    });
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      className="mb-3 w-[48%] rounded-2xl border border-border bg-card p-4 shadow-sm"
    >
      <View
        className="mb-3 h-11 w-11 items-center justify-center rounded-xl"
        style={{ backgroundColor: primarySoftColor }}
      >
        <Ionicons name={section.icon} size={22} color={primaryColor} />
      </View>
      <Text className="text-[15px] font-semibold text-foreground" numberOfLines={2}>
        {section.label}
      </Text>
      {!section.ready ? (
        <Text className="mt-1 text-[11px] font-medium" style={{ color: mutedIconColor }}>
          Soon
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

export default function AdminDashboardScreen() {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const user = useAppSelector((s) => s.user.data);
  const { statusBarStyle, backgroundColor, iconColor, primaryColor, primarySoftColor } =
    useAppTheme();

  async function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          const pushToken = getCurrentPushToken();
          if (pushToken) await unsubscribePushToken(pushToken);

          await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
          await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
          // Reset every slice to initial state, then clear what's on disk so no
          // user-scoped data survives logout.
          dispatch(resetStore());
          await persistor.purge();
          clearAdminCache();
          resetPusherClient();
          router.replace("/");
        },
      },
    ]);
  }

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      <ScrollView
        contentContainerStyle={{
          paddingTop: Math.max(insets.top + 16, 44),
          paddingBottom: Math.max(insets.bottom + 24, 32),
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card">
              <Image
                source={require("../../assets/images/logo.png")}
                style={{ width: 26, height: 26 }}
                resizeMode="contain"
              />
            </View>
            <View>
              <Text className="text-[13px] font-medium text-muted-foreground">
                Admin Console
              </Text>
              <Text className="text-[18px] font-bold tracking-tight text-foreground">
                {user?.name ?? "Administrator"}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleSignOut}
            activeOpacity={0.85}
            className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
          >
            <Ionicons name="log-out-outline" size={20} color={iconColor} />
          </TouchableOpacity>
        </View>

        {/* Hero / summary */}
        <View
          className="mt-6 rounded-3xl border border-border p-5"
          style={{ backgroundColor: primarySoftColor }}
        >
          <Text className="text-[15px] font-semibold text-foreground">
            Manage the platform
          </Text>
          <Text className="mt-1 text-[13px] leading-5 text-muted-foreground">
            {ADMIN_SECTION_COUNT} admin sections, mirrored from the web console with a
            mobile-first layout. Sections roll out one at a time.
          </Text>
        </View>

        {/* Section groups */}
        {ADMIN_SECTION_GROUPS.map((group) => (
          <View key={group.category} className="mt-7">
            <Text className="mb-3 ml-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {group.category}
            </Text>
            <View className="flex-row flex-wrap justify-between">
              {group.items.map((section) => (
                <SectionCard key={section.id} section={section} />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
