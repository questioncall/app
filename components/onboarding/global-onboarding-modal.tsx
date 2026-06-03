import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEvent } from "expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { api } from "@/lib/api";
import { useAppTheme } from "@/hooks/use-app-theme";
import {
  markOnboardingSeen,
  setOnboardingDismissing,
  type OnboardingVideo,
} from "@/store/slices/onboardingSlice";
import { updateUser } from "@/store/slices/userSlice";

export function GlobalOnboardingModal() {
  const { shouldShow, video } = useAppSelector((s) => s.onboarding);

  if (!shouldShow || !video) return null;

  return <OnboardingModalBody video={video} />;
}

function OnboardingModalBody({ video }: { video: OnboardingVideo }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.user.data);
  const role = useAppSelector((s) => s.onboarding.role);
  const isDismissing = useAppSelector((s) => s.onboarding.isDismissing);
  const { primaryColor, mutedIconColor } = useAppTheme();
  const insets = useSafeAreaInsets();

  // useVideoPlayer plays HLS (.m3u8) and mp4/webm/mov natively — covers Mux
  // playback URLs and Cloudinary/R2 hosted assets (our own player, not YouTube).
  const player = useVideoPlayer(video.videoUrl, (p) => {
    p.loop = false;
    p.muted = false;
  });

  // Drive a clean loading/error UI off the player status instead of showing a
  // bare black box while the (HLS/mp4) source buffers. statusChange fires with
  // "loading" → "readyToPlay", or "error" if the URL can't be played.
  const { status, error } = useEvent(player, "statusChange", {
    status: player.status,
  });
  const isLoading = status === "loading" || status === "idle";
  const hasError = status === "error";

  // Dismissing the modal in any way marks the onboarding video as seen.
  async function handleDismiss() {
    if (isDismissing) return;

    dispatch(setOnboardingDismissing(true));
    try {
      await api.post("/onboarding-video/dismiss");
      if (role) {
        dispatch(
          updateUser({
            seenOnboardingRoles: [...(user?.seenOnboardingRoles ?? []), role],
          }),
        );
      }
      dispatch(markOnboardingSeen());
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

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleDismiss}>
      <View
        className="flex-1 justify-end bg-black/50 px-4"
        style={{ paddingBottom: insets.bottom + 24 }}
      >
        <View className="max-h-[88%] overflow-hidden rounded-[28px] border border-border bg-card">
          <View className="flex-row items-center gap-3 border-b border-border px-5 py-4">
            <Image
              source={require("../../assets/images/logo.png")}
              style={{ width: 34, height: 34 }}
              resizeMode="contain"
            />
            <View className="flex-1">
              <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {role ?? "Onboarding"}
              </Text>
              <Text className="text-lg font-bold text-card-foreground" numberOfLines={1}>
                QuestionCall
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleDismiss}
              disabled={isDismissing}
              className="h-10 w-10 items-center justify-center rounded-full bg-secondary"
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={19} color={mutedIconColor} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="aspect-video bg-black">
              <VideoView
                player={player}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
                fullscreenOptions={{ enable: true, orientation: "landscape" }}
                nativeControls
              />

              {/* Loading spinner while the source buffers */}
              {isLoading ? (
                <View className="absolute inset-0 items-center justify-center bg-black/60">
                  <ActivityIndicator color="#FFFFFF" size="large" />
                  <Text className="mt-3 text-xs text-white/70">Loading video…</Text>
                </View>
              ) : null}

              {/* Error fallback with retry */}
              {hasError ? (
                <View className="absolute inset-0 items-center justify-center gap-3 bg-black/80 px-6">
                  <Ionicons name="warning-outline" size={32} color="#f87171" />
                  <Text className="text-center text-sm text-white/80">
                    {error?.message ?? "Couldn't load this video."}
                  </Text>
                  <TouchableOpacity
                    onPress={() => player.replace(video.videoUrl)}
                    className="rounded-full bg-white/15 px-5 py-2"
                    activeOpacity={0.85}
                  >
                    <Text className="text-sm font-semibold text-white">Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            <View className="p-5">
              <Text className="text-xl font-bold text-card-foreground">
                {video.title}
              </Text>
              {video.description ? (
                <Text className="mt-3 text-sm leading-6 text-muted-foreground">
                  {video.description}
                </Text>
              ) : null}
            </View>
          </ScrollView>

          <View className="border-t border-border p-5">
            <TouchableOpacity
              onPress={handleDismiss}
              disabled={isDismissing}
              className="items-center justify-center rounded-full"
              style={{ backgroundColor: primaryColor, height: 54 }}
              activeOpacity={0.85}
            >
              {isDismissing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-base font-bold text-white">I watched this</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
