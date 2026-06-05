import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEvent } from "expo";
import { WebView } from "react-native-webview";

import { parseVideoSource } from "@/lib/video-source";

/**
 * Plays an onboarding video that may be either a direct media file (mp4/webm/
 * HLS — Mux/Cloudinary/R2) or a YouTube/Vimeo link. Direct files use the native
 * expo-video player; embeds fall back to an iframe inside a WebView, because the
 * native player can't decode a YouTube/Vimeo page URL (that was the black-screen
 * / stuck-at-0:00 bug). Fills its parent container.
 */
export function OnboardingVideoPlayer({ videoUrl }: { videoUrl: string }) {
  const parsed = parseVideoSource(videoUrl);
  const isEmbed = parsed.isEmbed;

  // The hook must run unconditionally, so feed it an empty source for embeds —
  // that keeps the native player from trying (and failing) to load a page URL.
  const player = useVideoPlayer(isEmbed ? "" : parsed.url, (p) => {
    p.loop = false;
    p.muted = false;
  });

  // statusChange drives the loading/error UI: "loading" → "readyToPlay", or
  // "error" if the URL can't be played.
  const { status, error } = useEvent(player, "statusChange", {
    status: player.status,
  });

  if (isEmbed) {
    return (
      <WebView
        source={{ uri: parsed.url }}
        style={{ flex: 1, backgroundColor: "#000" }}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View className="absolute inset-0 items-center justify-center bg-black">
            <ActivityIndicator color="#FFFFFF" size="large" />
          </View>
        )}
      />
    );
  }

  const isLoading = status === "loading" || status === "idle";
  const hasError = status === "error";

  return (
    <>
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
            onPress={() => player.replace(parsed.url)}
            className="rounded-full bg-white/15 px-5 py-2"
            activeOpacity={0.85}
          >
            <Text className="text-sm font-semibold text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </>
  );
}
