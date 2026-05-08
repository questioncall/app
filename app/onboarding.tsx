import { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { WebView } from "react-native-webview";
import Toast from "react-native-toast-message";

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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="px-5 pt-14">
          <View className="mb-6 flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => router.back()}
              className="h-11 w-11 items-center justify-center rounded-full bg-secondary"
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={20} color={iconColor} />
            </TouchableOpacity>
            <Text className="text-base font-bold text-foreground">Onboarding</Text>
            <View className="h-11 w-11" />
          </View>

          <View className="mb-5 flex-row items-center gap-3">
            <Image
              source={require("../assets/images/logo.png")}
              style={{ width: 40, height: 40 }}
              resizeMode="contain"
            />
            <View className="flex-1">
              <Text className="text-[28px] font-bold tracking-tight text-foreground">
                QuestionCall
              </Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                {user?.role === "TEACHER"
                  ? "A quick guide to accepting questions and earning points."
                  : "A quick guide to asking questions and getting help."}
              </Text>
            </View>
          </View>

          {onboarding.isLoading ? (
            <View className="h-80 items-center justify-center rounded-[28px] border border-border bg-card">
              <ActivityIndicator color={iconColor} size="large" />
            </View>
          ) : video ? (
            <>
              <View className="overflow-hidden rounded-[28px] border border-border bg-card">
                {video.thumbnailUrl ? (
                  <Image
                    source={{ uri: video.thumbnailUrl }}
                    className="h-40 w-full"
                    resizeMode="cover"
                  />
                ) : null}
                <View className="aspect-video bg-black">
                  <WebView
                    source={{ uri: video.videoUrl }}
                    allowsFullscreenVideo
                    mediaPlaybackRequiresUserAction={false}
                    style={{ flex: 1, backgroundColor: "#000000" }}
                  />
                </View>
                <View className="p-5">
                  <View
                    className="mb-3 self-start rounded-full px-3 py-1"
                    style={{ backgroundColor: primarySoftColor }}
                  >
                    <Text className="text-xs font-bold" style={{ color: primaryColor }}>
                      {video.role}
                    </Text>
                  </View>
                  <Text className="text-xl font-bold text-card-foreground">
                    {video.title}
                  </Text>
                  {video.description ? (
                    <Text className="mt-3 text-sm leading-6 text-muted-foreground">
                      {video.description}
                    </Text>
                  ) : null}
                </View>
              </View>

              <TouchableOpacity
                onPress={handleComplete}
                disabled={onboarding.isDismissing}
                className="mt-6 items-center justify-center rounded-full"
                style={{ backgroundColor: primaryColor, height: 54 }}
                activeOpacity={0.85}
              >
                {onboarding.isDismissing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-base font-bold text-white">I watched this</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View className="items-center rounded-[28px] border border-border bg-card px-6 py-14">
              <View
                className="mb-4 h-16 w-16 items-center justify-center rounded-3xl"
                style={{ backgroundColor: primarySoftColor }}
              >
                <Ionicons name="play-circle-outline" size={34} color={primaryColor} />
              </View>
              <Text className="text-center text-lg font-bold text-card-foreground">
                No onboarding video yet
              </Text>
              <Text className="mt-2 text-center text-sm leading-6 text-muted-foreground">
                When the admin posts a role-specific video, it will appear here.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
