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
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { clearAuth } from "@/store/slices/authSlice";
import { clearUser } from "@/store/slices/userSlice";
import { clearActivityCache } from "@/store/slices/activitySlice";
import { clearNotices } from "@/store/slices/noticesSlice";
import { clearOnboarding } from "@/store/slices/onboardingSlice";
import { clearRealtime } from "@/store/slices/realtimeSlice";
import { SECURE_STORE_KEYS } from "@/lib/api";
import { resetPusherClient } from "@/lib/realtime";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface MenuItemProps {
  icon: IoniconName;
  label: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
  badge?: string;
}

function MenuItem({ icon, label, subtitle, onPress, danger, badge }: MenuItemProps) {
  const { primaryColor, primarySoftColor, mutedIconColor } = useAppTheme();
  const itemColor = danger ? "#EF4444" : primaryColor;

  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center px-4 py-3.5"
      activeOpacity={0.7}
    >
      <View
        className="mr-3 h-9 w-9 items-center justify-center rounded-xl"
        style={{
          backgroundColor: danger ? "rgba(239,68,68,0.12)" : primarySoftColor,
        }}
      >
        <Ionicons name={icon} size={18} color={itemColor} />
      </View>
      <View className="flex-1">
        <Text
          className={`text-base font-medium ${
            danger ? "text-red-500 dark:text-red-300" : "text-foreground"
          }`}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-xs text-muted-foreground">{subtitle}</Text>
        ) : null}
      </View>
      {badge ? (
        <View
          className="mr-2 rounded-full px-2 py-0.5"
          style={{ backgroundColor: primaryColor }}
        >
          <Text className="text-xs font-semibold text-white">{badge}</Text>
        </View>
      ) : null}
      <Ionicons
        name="chevron-forward"
        size={16}
        color={danger ? "#EF4444" : mutedIconColor}
      />
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View className="px-4 pb-2 pt-5">
      <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </Text>
    </View>
  );
}

function Divider() {
  return <View className="mx-4 h-px bg-border" />;
}

export default function MenuScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.user.data);
  const config = useAppSelector((s) => s.config.data);
  const { statusBarStyle, backgroundColor, primaryColor, primarySoftColor } =
    useAppTheme();
  const isTeacher = user?.role === "TEACHER";

  async function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
          await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
          dispatch(clearAuth());
          dispatch(clearUser());
          dispatch(clearActivityCache());
          dispatch(clearNotices());
          dispatch(clearOnboarding());
          dispatch(clearRealtime());
          resetPusherClient();
          router.replace("/");
        },
      },
    ]);
  }

  const pointBalance = isTeacher ? (user?.pointBalance ?? 0) : (user?.points ?? 0);
  const nprRate = config?.pointToNprRate ?? 1;
  const nprEquivalent = (pointBalance * nprRate).toFixed(2);

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      <View className="px-6 pb-2 pt-14">
        <Text className="text-[28px] font-bold tracking-tight text-foreground">Menu</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Profile Card */}
        <View className="mx-4 my-3 flex-row items-center rounded-2xl border border-border bg-card p-4">
          {user?.image ? (
            <Image source={{ uri: user.image }} className="mr-4 h-14 w-14 rounded-full" />
          ) : (
            <View
              className="mr-4 h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: primaryColor }}
            >
              <Text className="text-2xl font-bold text-white">
                {(user?.name ?? "U")[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View className="flex-1">
            <Text className="text-lg font-bold text-card-foreground" numberOfLines={1}>
              {user?.name ?? "Loading..."}
            </Text>
            <View className="mt-0.5 flex-row items-center gap-2">
              <View
                className="rounded-full px-2 py-0.5"
                style={{ backgroundColor: primarySoftColor }}
              >
                <Text className="text-xs font-semibold" style={{ color: primaryColor }}>
                  {user?.role ?? "—"}
                </Text>
              </View>
              <Text className="text-xs text-muted-foreground">
                {user?.planSlug ?? "free"}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/profile/edit" as any)}
            className="rounded-xl bg-secondary px-3 py-2"
          >
            <Text className="text-xs font-medium text-secondary-foreground">Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Wallet card */}
        <View
          className="mx-4 mb-2 rounded-2xl border border-border p-4"
          style={{ backgroundColor: primarySoftColor }}
        >
          <Text className="mb-1 text-xs text-muted-foreground">
            {isTeacher ? "Point Balance" : "Quiz Points"}
          </Text>
          <Text className="text-3xl font-bold text-foreground">
            {pointBalance.toLocaleString()}{" "}
            <Text className="text-base font-normal text-muted-foreground">pts</Text>
          </Text>
          <Text className="mt-0.5 text-sm text-muted-foreground">
            ≈ NPR {nprEquivalent}
          </Text>
        </View>

        {/* Profile section */}
        <SectionHeader title="Profile" />
        <View className="mx-4 overflow-hidden rounded-2xl border border-border bg-card">
          <MenuItem
            icon="person-outline"
            label="Edit Profile"
            onPress={() => router.push("/profile/edit" as any)}
          />
          <Divider />
          <MenuItem
            icon="stats-chart-outline"
            label="My Activity"
            onPress={() => router.push("/profile/activity" as any)}
          />
        </View>

        {/* Wallet & Transactions */}
        <SectionHeader title="Wallet & Transactions" />
        <View className="mx-4 overflow-hidden rounded-2xl border border-border bg-card">
          <MenuItem
            icon="wallet-outline"
            label="Wallet"
            subtitle={`${pointBalance} pts · NPR ${nprEquivalent}`}
            onPress={() =>
              Alert.alert(
                "Wallet",
                "Wallet with biometric gate — coming soon in the next sprint!",
              )
            }
          />
          {isTeacher ? (
            <>
              <Divider />
              <MenuItem
                icon="cash-outline"
                label="Withdraw"
                subtitle="Transfer to eSewa"
                onPress={() => Alert.alert("Withdraw", "Withdrawal flow — coming soon!")}
              />
            </>
          ) : null}
          <Divider />
          <MenuItem
            icon="receipt-outline"
            label="Transaction History"
            onPress={() => Alert.alert("Transactions", "History — coming soon!")}
          />
          {isTeacher ? (
            <>
              <Divider />
              <MenuItem
                icon="flag-outline"
                label="Daily Target"
                subtitle={`${user?.dailyAnswersCount ?? 0} answers today`}
                onPress={() => Alert.alert("Daily Target", "Tracker — coming soon!")}
              />
            </>
          ) : null}
        </View>

        {/* Services */}
        <SectionHeader title="Services" />
        <View className="mx-4 overflow-hidden rounded-2xl border border-border bg-card">
          {isTeacher ? (
            <>
              <MenuItem
                icon="videocam-outline"
                label="Course Studio"
                subtitle="Manage your courses"
                onPress={() => router.push("/studio" as any)}
              />
              <Divider />
            </>
          ) : null}
          <MenuItem
            icon="bulb-outline"
            label="AI Quizzes"
            subtitle="Test your knowledge"
            onPress={() => router.push("/quiz" as any)}
          />
          <Divider />
          <MenuItem
            icon="trophy-outline"
            label="Leaderboard"
            onPress={() => router.push("/leaderboard" as any)}
          />
          <Divider />
          <MenuItem
            icon="gift-outline"
            label="Referrals"
            subtitle="Invite friends, earn bonus questions"
            onPress={() => router.push("/referral" as any)}
          />
          <Divider />
          <MenuItem
            icon="megaphone-outline"
            label="Notices"
            onPress={() => router.push("/notices" as any)}
          />
        </View>

        {/* Account */}
        <SectionHeader title="Account" />
        <View className="mx-4 overflow-hidden rounded-2xl border border-border bg-card">
          <MenuItem
            icon="diamond-outline"
            label="Subscription Plans"
            subtitle={`Current: ${user?.planSlug ?? "Free"}`}
            onPress={() => router.push("/payment/plans" as any)}
          />
          <Divider />
          <MenuItem
            icon="notifications-outline"
            label="Notifications"
            onPress={() => router.push("/settings/notifications" as any)}
          />
          <Divider />
          <MenuItem
            icon="call-outline"
            label="Call Settings"
            onPress={() => router.push("/settings/call-settings" as any)}
          />
          <Divider />
          <MenuItem
            icon="play-circle-outline"
            label="Onboarding Videos"
            onPress={() => router.push("/onboarding" as any)}
          />
          <Divider />
          <MenuItem
            icon="document-text-outline"
            label="Terms of Use"
            onPress={() => router.push("/legal/terms" as any)}
          />
          <Divider />
          <MenuItem
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => router.push("/legal/privacy" as any)}
          />
          <Divider />
          <MenuItem
            icon="key-outline"
            label="Change Password"
            onPress={() => Alert.alert("Change Password", "Coming soon!")}
          />
          <Divider />
          <MenuItem
            icon="contrast-outline"
            label="Theme"
            onPress={() => router.push("/settings/theme" as any)}
          />
        </View>

        {/* Danger Zone */}
        <SectionHeader title="Danger Zone" />
        <View className="mx-4 mb-8 overflow-hidden rounded-2xl border border-border bg-card">
          <MenuItem
            icon="log-out-outline"
            label="Sign Out"
            onPress={handleSignOut}
            danger
          />
          <Divider />
          <MenuItem
            icon="trash-outline"
            label="Delete Account"
            subtitle="This action is irreversible"
            onPress={() =>
              Alert.alert(
                "Delete Account",
                "To delete your account, please contact support.",
                [{ text: "OK" }],
              )
            }
            danger
          />
        </View>
      </ScrollView>
    </View>
  );
}
