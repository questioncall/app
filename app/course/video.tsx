import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBar, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";

import { api } from "@/lib/api";

const PROGRESS_PING_INTERVAL_MS = 10_000;

export default function CourseVideoScreen() {
  const { courseId, videoId, title, videoUrl } = useLocalSearchParams<{
    courseId: string;
    videoId: string;
    title?: string;
    videoUrl?: string;
  }>();

  const [videoSrc, setVideoSrc] = useState<string | null>(videoUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const lastPingAt = useRef(0);
  const watchedSecondsRef = useRef(0);

  useEffect(() => {
    if (videoSrc) return;
    if (!courseId || !videoId) {
      setError("Missing course or video ID");
      return;
    }
    (async () => {
      try {
        const res = await api.get(`/courses/${courseId}/videos/${videoId}`);
        const d = res.data;
        // Prefer web-constructed playbackUrl which already includes Mux logic
        const src = d.playbackUrl ?? d.muxPlaybackId ?? d.videoUrl ?? d.url ?? null;
        if (!src) {
          setError("Video URL not available");
          return;
        }
        setVideoSrc(src);
      } catch (err) {
        console.error("[Video load error]", err);
        setError("Unable to load video. You may not have access.");
      }
    })();
  }, [courseId, videoId, videoSrc]);

  const player = useVideoPlayer(videoSrc ?? "", (p) => {
    p.loop = false;
  });

  const sendProgressPing = useCallback(async () => {
    if (!courseId || !videoId) return;
    const now = Date.now();
    if (now - lastPingAt.current < PROGRESS_PING_INTERVAL_MS) return;
    lastPingAt.current = now;

    try {
      await api.post(`/courses/${courseId}/progress`, {
        videoId,
        watchedSeconds: watchedSecondsRef.current,
      });
    } catch {}
  }, [courseId, videoId]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (player.playing) {
        watchedSecondsRef.current = Math.floor(player.currentTime);
        void sendProgressPing();
      }
    }, PROGRESS_PING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [player, sendProgressPing]);

  useEffect(() => {
    return () => {
      if (watchedSecondsRef.current > 0) {
        api
          .post(`/courses/${courseId}/progress`, {
            videoId,
            watchedSeconds: watchedSecondsRef.current,
          })
          .catch(() => {});
      }
    };
  }, [courseId, videoId]);

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-8">
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text className="mt-3 text-center text-base text-white">{error}</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 rounded-full bg-white/20 px-6 py-2.5"
        >
          <Text className="font-semibold text-white">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View className="flex-row items-center px-4 pb-2 pt-14">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="flex-1 text-base font-semibold text-white" numberOfLines={1}>
          {title ?? "Video"}
        </Text>
      </View>

      {/* Video player */}
      <View className="flex-1 items-center justify-center">
        {videoSrc ? (
          <VideoView
            player={player}
            style={{ width: "100%", height: "100%" }}
            fullscreenOptions={{ enable: true, orientation: "landscape" }}
            allowsPictureInPicture
            nativeControls
          />
        ) : (
          <Text className="text-base text-white/60">Loading video...</Text>
        )}
      </View>
    </View>
  );
}
