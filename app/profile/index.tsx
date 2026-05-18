import { ScrollView, StatusBar, Text, TouchableOpacity, View, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useAppSelector } from "@/hooks/redux";
import { useAppTheme } from "@/hooks/use-app-theme";
import { PlanBadge } from "@/components/PlanBadge";

function StatCard({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string | number;
  onPress?: () => void;
}) {
  const { primaryColor, primarySoftColor } = useAppTheme();
  const inner = (
    <>
      <Text className="text-xl font-bold" style={{ color: primaryColor }}>
        {value}
      </Text>
      <Text className="mt-0.5 text-xs text-muted-foreground">{label}</Text>
      {onPress ? (
        <Ionicons
          name="chevron-forward"
          size={11}
          color={primaryColor}
          style={{ marginTop: 2, opacity: 0.7 }}
        />
      ) : null}
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        className="flex-1 items-center rounded-2xl py-4"
        style={{ backgroundColor: primarySoftColor }}
      >
        {inner}
      </TouchableOpacity>
    );
  }
  return (
    <View
      className="flex-1 items-center rounded-2xl py-4"
      style={{ backgroundColor: primarySoftColor }}
    >
      {inner}
    </View>
  );
}

function ChipRow({ items, color }: { items?: string[]; color: string }) {
  if (!items?.length) return <Text className="text-sm text-muted-foreground">—</Text>;
  return (
    <View className="flex-row flex-wrap gap-2">
      {items.map((item) => (
        <View
          key={item}
          className="rounded-full px-3 py-1"
          style={{ backgroundColor: `${color}18` }}
        >
          <Text className="text-xs font-medium" style={{ color }}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <Text className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {title}
    </Text>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  const { primaryColor } = useAppTheme();
  return (
    <View className="flex-row items-center py-3">
      <View
        className="mr-3 h-8 w-8 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${primaryColor}15` }}
      >
        <Ionicons name={icon as any} size={15} color={primaryColor} />
      </View>
      <Text className="w-32 text-sm text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-sm font-medium text-foreground">{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const user = useAppSelector((s) => s.user.data);
  const {
    statusBarStyle,
    backgroundColor,
    primaryColor,
    primarySoftColor,
    borderColor,
    cardColor,
  } = useAppTheme();

  const isTeacher = user?.role === "TEACHER";
  const initials = (user?.name ?? "U").slice(0, 2).toUpperCase();

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "—";

  const questionsLeft =
    (user?.maxQuestions ?? 0) + (user?.bonusQuestions ?? 0) - (user?.questionsAsked ?? 0);

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pb-2 pt-14">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-secondary"
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color={primaryColor} />
        </TouchableOpacity>
        <Text className="text-base font-bold text-foreground">Profile</Text>
        <TouchableOpacity
          onPress={() => router.push("/profile/edit" as any)}
          className="rounded-xl px-4 py-2"
          style={{ backgroundColor: primaryColor }}
          activeOpacity={0.85}
        >
          <Text className="text-xs font-semibold text-white">Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48, paddingHorizontal: 16 }}
      >
        {/* Avatar + Identity */}
        <View
          className="mt-4 items-center rounded-3xl border py-8"
          style={{ backgroundColor: cardColor, borderColor }}
        >
          <View style={{ width: 108, height: 108 }}>
            {user?.image ? (
              <Image
                source={{ uri: user.image }}
                style={{ width: 108, height: 108, borderRadius: 54 }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: 108,
                  height: 108,
                  borderRadius: 54,
                  backgroundColor: primaryColor,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text className="text-4xl font-bold text-white">{initials}</Text>
              </View>
            )}
          </View>

          <Text className="mt-4 text-2xl font-bold text-foreground">
            {user?.name ?? "—"}
          </Text>

          {user?.username ? (
            <Text className="mt-0.5 text-sm text-muted-foreground">@{user.username}</Text>
          ) : null}

          <View className="mt-2 flex-row items-center gap-2">
            <View
              className="rounded-full px-3 py-1"
              style={{ backgroundColor: primarySoftColor }}
            >
              <Text className="text-xs font-semibold" style={{ color: primaryColor }}>
                {user?.role ?? "USER"}
              </Text>
            </View>
            {user?.planSlug ? <PlanBadge slug={user.planSlug} size="md" /> : null}
            {isTeacher && user?.isMonetized ? (
              <View className="rounded-full bg-emerald-100 px-3 py-1 dark:bg-emerald-900">
                <Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                  Monetized
                </Text>
              </View>
            ) : null}
          </View>

          <Text className="mt-2 text-xs text-muted-foreground">
            Member since {memberSince}
          </Text>

          {user?.bio ? (
            <Text className="mt-4 px-6 text-center text-sm leading-5 text-foreground">
              {user.bio}
            </Text>
          ) : (
            <Text className="mt-4 text-sm italic text-muted-foreground">
              No bio added yet
            </Text>
          )}
        </View>

        {/* Stats */}
        <View className="mt-5 flex-row gap-3">
          {isTeacher ? (
            <>
              <StatCard label="Point Balance" value={user?.pointBalance ?? 0} />
              <StatCard label="Answers Today" value={user?.dailyAnswersCount ?? 0} />
              <StatCard
                label="Targets Hit"
                value={user?.dailyTargetsAchieved?.length ?? 0}
              />
            </>
          ) : (
            <>
              <StatCard
                label="Questions Asked"
                value={user?.questionsAsked ?? 0}
                onPress={() => router.push("/profile/my-questions" as any)}
              />
              <StatCard label="Quiz Points" value={user?.points ?? 0} />
              <StatCard label="Remaining" value={Math.max(0, questionsLeft)} />
            </>
          )}
        </View>

        {/* Teacher: posted assets */}
        {isTeacher && (
          <View
            className="mt-5 rounded-3xl border p-5"
            style={{ backgroundColor: cardColor, borderColor }}
          >
            <Text className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              My Content
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/studio" as any)}
              activeOpacity={0.8}
              className="flex-row items-center py-3"
            >
              <View
                className="mr-3 h-8 w-8 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                <Ionicons name="book-outline" size={15} color={primaryColor} />
              </View>
              <Text className="flex-1 text-sm font-medium text-foreground">
                My Courses
              </Text>
              <Ionicons name="chevron-forward" size={16} color={primaryColor} />
            </TouchableOpacity>
            <View className="h-px bg-border" />
            <TouchableOpacity
              onPress={() => router.push("/profile/my-notes" as any)}
              activeOpacity={0.8}
              className="flex-row items-center py-3"
            >
              <View
                className="mr-3 h-8 w-8 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                <Ionicons name="document-text-outline" size={15} color={primaryColor} />
              </View>
              <Text className="flex-1 text-sm font-medium text-foreground">My Notes</Text>
              <Ionicons name="chevron-forward" size={16} color={primaryColor} />
            </TouchableOpacity>
          </View>
        )}

        {/* Skills */}
        <View
          className="mt-5 rounded-3xl border p-5"
          style={{ backgroundColor: cardColor, borderColor }}
        >
          <SectionLabel title="Skills" />
          <ChipRow items={user?.skills} color={primaryColor} />
        </View>

        {/* Interests */}
        <View
          className="mt-4 rounded-3xl border p-5"
          style={{ backgroundColor: cardColor, borderColor }}
        >
          <SectionLabel title="Interests" />
          <ChipRow items={user?.interests} color={primaryColor} />
        </View>

        {/* Account details */}
        <View
          className="mt-4 rounded-3xl border px-5"
          style={{ backgroundColor: cardColor, borderColor }}
        >
          <SectionLabel title="" />
          <InfoRow icon="mail-outline" label="Email" value={user?.email ?? "—"} />
          <View className="h-px bg-border" />
          <InfoRow
            icon="diamond-outline"
            label="Subscription"
            value={`${(user?.planSlug ?? "free").toUpperCase()} · ${user?.subscriptionStatus ?? "inactive"}`}
          />
          {user?.subscriptionEnd ? (
            <>
              <View className="h-px bg-border" />
              <InfoRow
                icon="calendar-outline"
                label="Renews"
                value={new Date(user.subscriptionEnd).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              />
            </>
          ) : null}
          {!isTeacher ? (
            <>
              <View className="h-px bg-border" />
              <InfoRow
                icon="help-circle-outline"
                label="Max Questions"
                value={`${user?.maxQuestions ?? 0} + ${user?.bonusQuestions ?? 0} bonus`}
              />
            </>
          ) : null}
          {user?.esewaNumber ? (
            <>
              <View className="h-px bg-border" />
              <InfoRow
                icon="phone-portrait-outline"
                label="eSewa"
                value={user.esewaNumber}
              />
            </>
          ) : null}
          {user?.referralCode ? (
            <>
              <View className="h-px bg-border" />
              <InfoRow
                icon="gift-outline"
                label="Referral Code"
                value={user.referralCode}
              />
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
