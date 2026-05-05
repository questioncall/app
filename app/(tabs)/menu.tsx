import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { clearAuth } from "@/store/slices/authSlice";
import { clearUser } from "@/store/slices/userSlice";
import { SECURE_STORE_KEYS } from "@/lib/api";

interface MenuItemProps {
  emoji: string;
  label: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
  badge?: string;
}

function MenuItem({
  emoji,
  label,
  subtitle,
  onPress,
  danger,
  badge,
}: MenuItemProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center py-3.5 px-4"
      activeOpacity={0.7}
    >
      <Text className="text-xl mr-3">{emoji}</Text>
      <View className="flex-1">
        <Text
          className={`text-base font-medium ${
            danger ? "text-red-400" : "text-white"
          }`}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text className="text-slate-500 text-xs mt-0.5">{subtitle}</Text>
        ) : null}
      </View>
      {badge ? (
        <View className="bg-blue-500 rounded-full px-2 py-0.5 mr-2">
          <Text className="text-white text-xs font-semibold">{badge}</Text>
        </View>
      ) : null}
      <Text className={danger ? "text-red-600" : "text-slate-600"}>›</Text>
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View className="px-4 pt-5 pb-2">
      <Text className="text-slate-500 text-xs font-semibold tracking-widest uppercase">
        {title}
      </Text>
    </View>
  );
}

function Divider() {
  return <View className="h-px bg-slate-800 mx-4" />;
}

export default function MenuScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.user.data);
  const config = useAppSelector((s) => s.config.data);
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
          router.replace("/");
        },
      },
    ]);
  }

  const pointBalance = isTeacher ? (user?.pointBalance ?? 0) : (user?.points ?? 0);
  const nprRate = config?.pointToNprRate ?? 1;
  const nprEquivalent = (pointBalance * nprRate).toFixed(2);

  return (
    <View className="flex-1 bg-slate-950">
      <View className="px-4 pt-14 pb-2">
        <Text className="text-white text-2xl font-bold">Menu</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Profile Card */}
        <View className="mx-4 my-3 bg-slate-900 rounded-2xl p-4 border border-slate-800 flex-row items-center">
          {user?.image ? (
            <Image
              source={{ uri: user.image }}
              className="w-14 h-14 rounded-full mr-4"
            />
          ) : (
            <View className="w-14 h-14 rounded-full bg-blue-600 items-center justify-center mr-4">
              <Text className="text-white text-2xl font-bold">
                {(user?.name ?? "U")[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View className="flex-1">
            <Text className="text-white font-bold text-lg" numberOfLines={1}>
              {user?.name ?? "Loading..."}
            </Text>
            <View className="flex-row items-center gap-2 mt-0.5">
              <View className="bg-blue-900 rounded-full px-2 py-0.5">
                <Text className="text-blue-300 text-xs font-semibold">
                  {user?.role ?? "—"}
                </Text>
              </View>
              <Text className="text-slate-400 text-xs">{user?.planSlug ?? "free"}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/profile/edit" as any)}
            className="bg-slate-800 rounded-xl px-3 py-2"
          >
            <Text className="text-white text-xs font-medium">Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Wallet card */}
        <View className="mx-4 mb-2 bg-gradient-to-r from-blue-900 to-slate-900 rounded-2xl p-4 border border-blue-800">
          <Text className="text-slate-400 text-xs mb-1">
            {isTeacher ? "Point Balance" : "Quiz Points"}
          </Text>
          <Text className="text-white text-3xl font-bold">
            {pointBalance.toLocaleString()}{" "}
            <Text className="text-slate-400 text-base font-normal">pts</Text>
          </Text>
          <Text className="text-slate-400 text-sm mt-0.5">
            ≈ NPR {nprEquivalent}
          </Text>
        </View>

        {/* Profile section */}
        <SectionHeader title="Profile" />
        <View className="mx-4 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
          <MenuItem
            emoji="👤"
            label="Edit Profile"
            onPress={() => router.push("/profile/edit" as any)}
          />
          <Divider />
          <MenuItem
            emoji="📊"
            label="My Activity"
            onPress={() => router.push("/profile/activity" as any)}
          />
        </View>

        {/* Wallet & Transactions */}
        <SectionHeader title="Wallet & Transactions" />
        <View className="mx-4 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
          <MenuItem
            emoji="💳"
            label="Wallet"
            subtitle={`${pointBalance} pts · NPR ${nprEquivalent}`}
            onPress={() =>
              Alert.alert(
                "Wallet",
                "Wallet with biometric gate — coming soon in the next sprint!"
              )
            }
          />
          {isTeacher ? (
            <>
              <Divider />
              <MenuItem
                emoji="💸"
                label="Withdraw"
                subtitle="Transfer to eSewa"
                onPress={() =>
                  Alert.alert("Withdraw", "Withdrawal flow — coming soon!")
                }
              />
            </>
          ) : null}
          <Divider />
          <MenuItem
            emoji="📜"
            label="Transaction History"
            onPress={() =>
              Alert.alert("Transactions", "History — coming soon!")
            }
          />
          {isTeacher ? (
            <>
              <Divider />
              <MenuItem
                emoji="🎯"
                label="Daily Target"
                subtitle={`${user?.dailyAnswersCount ?? 0} answers today`}
                onPress={() => Alert.alert("Daily Target", "Tracker — coming soon!")}
              />
            </>
          ) : null}
        </View>

        {/* Services */}
        <SectionHeader title="Services" />
        <View className="mx-4 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
          {isTeacher ? (
            <>
              <MenuItem
                emoji="🎬"
                label="Course Studio"
                subtitle="Manage your courses"
                onPress={() => router.push("/studio" as any)}
              />
              <Divider />
            </>
          ) : null}
          <MenuItem
            emoji="🧠"
            label="AI Quizzes"
            subtitle="Test your knowledge"
            onPress={() => router.push("/quiz" as any)}
          />
          <Divider />
          <MenuItem
            emoji="🏆"
            label="Leaderboard"
            onPress={() => router.push("/leaderboard" as any)}
          />
          <Divider />
          <MenuItem
            emoji="🎁"
            label="Referrals"
            subtitle="Invite friends, earn bonus questions"
            onPress={() => router.push("/referral" as any)}
          />
          <Divider />
          <MenuItem
            emoji="📣"
            label="Notices"
            onPress={() => router.push("/notices" as any)}
          />
        </View>

        {/* Account */}
        <SectionHeader title="Account" />
        <View className="mx-4 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
          <MenuItem
            emoji="💎"
            label="Subscription Plans"
            subtitle={`Current: ${user?.planSlug ?? "Free"}`}
            onPress={() => router.push("/payment/plans" as any)}
          />
          <Divider />
          <MenuItem
            emoji="🔔"
            label="Notifications"
            onPress={() => router.push("/settings/notifications" as any)}
          />
          <Divider />
          <MenuItem
            emoji="📞"
            label="Call Settings"
            onPress={() => router.push("/settings/call-settings" as any)}
          />
          <Divider />
          <MenuItem
            emoji="🎥"
            label="Onboarding Videos"
            onPress={() => router.push("/onboarding" as any)}
          />
          <Divider />
          <MenuItem
            emoji="📋"
            label="Terms of Use"
            onPress={() => router.push("/legal/terms" as any)}
          />
          <Divider />
          <MenuItem
            emoji="🔏"
            label="Privacy Policy"
            onPress={() => router.push("/legal/privacy" as any)}
          />
          <Divider />
          <MenuItem
            emoji="🔑"
            label="Change Password"
            onPress={() => Alert.alert("Change Password", "Coming soon!")}
          />
          <Divider />
          <MenuItem
            emoji="🌙"
            label="Theme"
            onPress={() => router.push("/settings/theme" as any)}
          />
        </View>

        {/* Danger Zone */}
        <SectionHeader title="Danger Zone" />
        <View className="mx-4 mb-8 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
          <MenuItem
            emoji="🚪"
            label="Sign Out"
            onPress={handleSignOut}
            danger
          />
          <Divider />
          <MenuItem
            emoji="🗑️"
            label="Delete Account"
            subtitle="This action is irreversible"
            onPress={() =>
              Alert.alert(
                "Delete Account",
                "To delete your account, please contact support.",
                [{ text: "OK" }]
              )
            }
            danger
          />
        </View>
      </ScrollView>
    </View>
  );
}
