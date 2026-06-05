import { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { OnboardingVideoPlayer } from "@/components/onboarding/onboarding-video-player";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { api } from "@/lib/api";
import { useAppTheme } from "@/hooks/use-app-theme";
import {
  markOnboardingSeen,
  setOnboardingData,
  setOnboardingDismissing,
  setOnboardingError,
  setOnboardingLoading,
} from "@/store/slices/onboardingSlice";
import { updateUser } from "@/store/slices/userSlice";

export default function OnboardingScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.user.data);
  const onboarding = useAppSelector((s) => s.onboarding);
  const { statusBarStyle, backgroundColor, iconColor, primaryColor, primarySoftColor } =
    useAppTheme();
  const insets = useSafeAreaInsets();

  const loadOnboarding = useCallback(async () => {
    if (!user?._id) return;

    dispatch(setOnboardingLoading(true));
    try {
      const res = await api.get("/onboarding-video");
      dispatch(
        setOnboardingData({
          shouldShow: Boolean(res.data?.shouldShow),
          role: res.data?.role ?? user.role,
          video: res.data?.video ?? null,
          userId: user._id,
        }),
      );
    } catch (err: any) {
      dispatch(
        setOnboardingError(
          err?.response?.data?.error ?? "Unable to load onboarding video.",
        ),
      );
    }
  }, [dispatch, user?._id, user?.role]);

  useEffect(() => {
    if (!onboarding.video && user?._id) {
      void loadOnboarding();
    }
  }, [loadOnboarding, onboarding.video, user?._id]);

  async function handleComplete() {
    if (!onboarding.video || onboarding.isDismissing) return;

    dispatch(setOnboardingDismissing(true));
    try {
      await api.post("/onboarding-video/dismiss");
      dispatch(markOnboardingSeen());
      if (onboarding.role) {
        dispatch(
          updateUser({
            seenOnboardingRoles: [...(user?.seenOnboardingRoles ?? []), onboarding.role],
          }),
        );
      }
      Toast.show({ type: "success", text1: "Onboarding marked complete." });
      router.replace("/(tabs)/feed");
    } catch (err: any) {
      dispatch(setOnboardingDismissing(false));
      Toast.show({
        type: "error",
        text1:
          err?.response?.data?.error ??
          err?.response?.data?.message ??
          "Unable to mark onboarding complete.",
      });
    }
  }

  const video = onboarding.video;

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle={statusBarStyle} backgroundColor={backgroundColor} />

      {/* Header */}
      <View
        className="flex-row items-center justify-between px-5 pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-secondary"
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color={iconColor} />
        </TouchableOpacity>
        <Text className="text-base font-semibold text-foreground">Onboarding</Text>
        <View className="h-10 w-10" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {onboarding.isLoading ? (
          <View className="mx-4 mt-2 aspect-video items-center justify-center rounded-3xl bg-card">
            <ActivityIndicator color={iconColor} size="large" />
          </View>
        ) : video ? (
          <View className="px-4 pt-2">
            {/* Player */}
            <View className="aspect-video overflow-hidden rounded-3xl bg-black">
              <OnboardingVideoPlayer videoUrl={video.videoUrl} />
            </View>

            {/* Meta — clean, no heavy card chrome */}
            <View className="mt-5 px-1">
              <View
                className="mb-3 self-start rounded-full px-3 py-1"
                style={{ backgroundColor: primarySoftColor }}
              >
                <Text className="text-[11px] font-bold" style={{ color: primaryColor }}>
                  {video.role}
                </Text>
              </View>
              <Text className="text-2xl font-bold tracking-tight text-foreground">
                {video.title}
              </Text>
              {video.description ? (
                <Text className="mt-2 text-[15px] leading-7 text-muted-foreground">
                  {video.description}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <View className="mx-4 mt-2 items-center rounded-3xl bg-card px-6 py-16">
            <View
              className="mb-4 h-16 w-16 items-center justify-center rounded-3xl"
              style={{ backgroundColor: primarySoftColor }}
            >
              <Ionicons name="play-circle-outline" size={34} color={primaryColor} />
            </View>
            <Text className="text-center text-lg font-bold text-foreground">
              No onboarding video yet
            </Text>
            <Text className="mt-2 text-center text-sm leading-6 text-muted-foreground">
              When the admin posts a role-specific video, it will appear here.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky CTA */}
      {video ? (
        <View
          className="border-border/60 border-t px-4 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <TouchableOpacity
            onPress={handleComplete}
            disabled={onboarding.isDismissing}
            className="items-center justify-center rounded-2xl"
            style={{ backgroundColor: primaryColor, height: 52 }}
            activeOpacity={0.85}
          >
            {onboarding.isDismissing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-bold text-white">I watched this</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
