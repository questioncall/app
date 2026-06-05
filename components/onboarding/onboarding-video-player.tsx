import { ActivityIndicator, Linking, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEvent } from "expo";
import { WebView } from "react-native-webview";

import { parseVideoSource, type VideoSourceKind } from "@/lib/video-source";

// YouTube/Vimeo/Loom embeds refuse to play inside a bare WebView because the
// document has no real web origin ("Error 153 / configuration error"). Loading
// the iframe via an HTML string with a matching https baseUrl gives the embed a
// valid origin so it plays.
const EMBED_ORIGIN: Partial<Record<VideoSourceKind, string>> = {
  youtube: "https://www.youtube.com",
  vimeo: "https://player.vimeo.com",
  loom: "https://www.loom.com",
};

function buildEmbedHtml(src: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{height:100%;background:#000;overflow:hidden}.wrap{position:fixed;inset:0}iframe{width:100%;height:100%;border:0;display:block}</style></head><body><div class="wrap"><iframe src="${src}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div></body></html>`;
}

/**
 * Plays an onboarding video that may be a direct media file (mp4/webm/HLS —
 * Mux/Cloudinary/R2) or a provider link (YouTube/Vimeo/Loom/Drive). Direct files
 * use the native expo-video player; provider links render as an embed inside a
 * WebView. A link we can't turn into a single video (e.g. a YouTube channel/
 * @handle URL) shows a clear message instead of dumping the whole site. Fills
 * its parent container.
 */
export function OnboardingVideoPlayer({ videoUrl }: { videoUrl: string }) {
  const parsed = parseVideoSource(videoUrl);
  const isFile = parsed.kind === "file";

  // The hook must run unconditionally. Only ever feed the native player a
  // confirmed direct-media URL — anything else stays empty so ExoPlayer/AVPlayer
  // never tries (and fails) to decode a page URL.
  const player = useVideoPlayer(isFile ? parsed.url : "", (p) => {
    p.loop = false;
    p.muted = false;
  });

  // statusChange drives the loading/error UI: "loading" → "readyToPlay", or
  // "error" if the URL can't be played.
  const { status, error } = useEvent(player, "statusChange", {
    status: player.status,
  });

  // A recognised-but-unplayable link (YouTube channel/@handle/playlist).
  if (parsed.kind === "unsupported") {
    return (
      <View className="absolute inset-0 items-center justify-center gap-3 bg-black px-6">
        <Ionicons name="logo-youtube" size={34} color="#f87171" />
        <Text className="text-center text-sm font-semibold text-white">
          This link points to a YouTube channel, not a video.
        </Text>
        <Text className="text-center text-xs text-white/60">
          Update the onboarding video in Admin to a single video link (youtu.be/… or
          youtube.com/watch?v=…).
        </Text>
        <TouchableOpacity
          onPress={() => void Linking.openURL(parsed.original)}
          className="mt-1 rounded-full bg-white/15 px-5 py-2"
          activeOpacity={0.85}
        >
          <Text className="text-sm font-semibold text-white">Open link</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (parsed.isEmbed) {
    const origin = EMBED_ORIGIN[parsed.kind];
    // Provider iframes (YouTube/Vimeo/Loom) need a real origin via baseUrl;
    // Drive/other pages load fine straight from the URL.
    const source = origin
      ? { html: buildEmbedHtml(parsed.url), baseUrl: origin }
      : { uri: parsed.url };

    return (
      <WebView
        source={source}
        originWhitelist={["*"]}
        style={{ flex: 1, backgroundColor: "#000" }}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
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
