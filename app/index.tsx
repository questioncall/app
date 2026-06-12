import { useEffect, useMemo } from "react";
import { Image, ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppSelector } from "@/hooks/redux";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function LandingScreen() {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const isLoading = useAppSelector((s) => s.auth.isLoading);
  const role = useAppSelector((s) => s.user.data?.role);
  const platformConfig = useAppSelector((s) => s.config.data);
  const insets = useSafeAreaInsets();
  const {
    statusBarStyle,
    backgroundColor,
    iconColor,
    primarySoftColor,
    borderColor,
    isDark,
  } = useAppTheme();
  const landingDisplayUserCount = useMemo(() => {
    if (typeof platformConfig?.landingDisplayUserCount === "number") {
      return platformConfig.landingDisplayUserCount;
    }

    const realUserCount =
      typeof platformConfig?.landingUserCount === "number"
        ? platformConfig.landingUserCount
        : 0;
    const offset =
      typeof platformConfig?.landingUserCountOffset === "number"
        ? platformConfig.landingUserCountOffset
        : 300;

    return realUserCount + offset;
  }, [platformConfig]);
  const formattedLandingUserCount = useMemo(
    () => Math.max(0, Math.round(landingDisplayUserCount)).toLocaleString("en-US"),
    [landingDisplayUserCount],
  );

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // Admins go to the admin console; everyone else lands on the feed.
      // Onboarding is shown as a global modal (GlobalOnboardingModal), so new
      // users land on the feed and the video overlays on top.
      router.replace(role === "ADMIN" ? "/admin" : "/(tabs)/feed");
    }
  }, [isAuthenticated, isLoading, role]);

  if (isLoading || isAuthenticated) return null;

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "space-between",
          paddingBottom: Math.max(insets.bottom + 28, 44),
          paddingHorizontal: 24,
          paddingTop: Math.max(insets.top + 24, 56),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center">
          <View
            className="mb-5 max-w-sm flex-row items-center justify-center rounded-full border px-3 py-2 shadow-sm"
            style={{
              position: "relative",
              backgroundColor: primarySoftColor,
              borderColor,
            }}
          >
            <View
              className="h-7 w-7 items-center justify-center rounded-full"
              style={{
                backgroundColor: isDark ? primarySoftColor : "rgba(0,0,0,0.03)",
              }}
            >
              <Ionicons name="sparkles-outline" size={15} color={iconColor} />
            </View>
            <View className="ml-2 shrink">
              <View
                className="self-start rounded-full border px-2 py-0.5"
                style={{
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(255,255,255,0.9)",
                  borderColor: isDark
                    ? "rgba(255,255,255,0.2)"
                    : "rgba(255,255,255,0.85)",
                  shadowColor: "#FFFFFF",
                  shadowOpacity: isDark ? 0.18 : 0.8,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 2,
                }}
              >
                <Text
                  className="text-[10px] font-extrabold uppercase tracking-widest"
                  style={{ color: isDark ? "#7EE5DC" : "#111827" }}
                >
                  Emerging platform
                </Text>
              </View>
              <Text className="text-[12px] font-bold leading-4 text-foreground">
                Already{" "}
                <Text className="font-extrabold">{formattedLandingUserCount}</Text> users
                on our platform
              </Text>
            </View>
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                bottom: -5,
                left: "50%",
                width: 10,
                height: 10,
                marginLeft: -5,
                transform: [{ rotate: "45deg" }],
                backgroundColor: primarySoftColor,
                borderBottomColor: borderColor,
                borderBottomWidth: 1,
                borderRightColor: borderColor,
                borderRightWidth: 1,
              }}
            />
          </View>

          <View className="mb-6 h-16 w-16 items-center justify-center rounded-3xl border border-border bg-card shadow-sm">
            <Image
              source={require("../assets/images/logo.png")}
              style={{ width: 42, height: 42 }}
              resizeMode="contain"
            />
          </View>
          <Text className="text-center text-[34px] font-bold tracking-tight text-foreground">
            QuestionCall
          </Text>
          <Text className="mt-4 max-w-sm text-center text-[24px] font-bold leading-8 tracking-tight text-foreground">
            Ask your question. Get a teacher working on them fast.
          </Text>
          <Text className="mt-4 max-w-sm text-center text-[15px] leading-6 text-muted-foreground">
            Students post academic questions, teachers accept them live, and a private
            answer screen opens right away.
          </Text>
          <Text className="mt-3 max-w-sm text-center text-[15px] leading-6 text-muted-foreground">
            Get help within minutes using chat, audio or video calls, and file sharing
            while the answer is being solved.
          </Text>
        </View>

        <View className="gap-3 pt-8">
          <TouchableOpacity
            className="flex-row items-center justify-center gap-2 rounded-full bg-primary py-4 shadow-lg"
            activeOpacity={0.85}
            onPress={() =>
              router.push({
                pathname: "/(auth)/register",
                params: { role: "STUDENT" },
              })
            }
          >
            <Ionicons name="school-outline" size={18} color="#FFFFFF" />
            <Text className="text-[16px] font-semibold text-primary-foreground">
              I&apos;m a Student
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center justify-center gap-2 rounded-full border border-border bg-card py-4 shadow-sm"
            activeOpacity={0.85}
            onPress={() =>
              router.push({
                pathname: "/(auth)/register",
                params: { role: "TEACHER" },
              })
            }
          >
            <Ionicons name="person-outline" size={18} color={iconColor} />
            <Text className="text-[16px] font-semibold text-card-foreground">
              I&apos;m a Teacher
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="items-center justify-center py-2"
            activeOpacity={0.85}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text className="text-[15px] font-semibold text-foreground">Sign in</Text>
          </TouchableOpacity>

          <Text className="px-2 pt-2 text-center text-[12px] leading-5 text-muted-foreground">
            By continuing, you agree to our{" "}
            <Text
              className="font-bold text-foreground underline"
              onPress={() => router.push("/legal/terms")}
            >
              Terms of Use
            </Text>{" "}
            and{" "}
            <Text
              className="font-bold text-foreground underline"
              onPress={() => router.push("/legal/privacy")}
            >
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
