import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";

import { api } from "@/lib/api";

type ContentResponse = {
  _id: string;
  type: "VIDEO" | "DOC";
  title: string;
  playbackUrl?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  isPreview?: boolean;
};

export default function ChapterContentScreen() {
  const { chapterId, contentId, title } = useLocalSearchParams<{
    chapterId: string;
    contentId: string;
    title?: string;
  }>();
  const [content, setContent] = useState<ContentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chapterId || !contentId) {
      setError("Missing content id");
      return;
    }
    api
      .get(`/chapters/${chapterId}/contents/${contentId}`)
      .then((res) => setContent(res.data as ContentResponse))
      .catch((err) =>
        setError(err?.response?.data?.error ?? "Unable to open this content."),
      );
  }, [chapterId, contentId]);

  const player = useVideoPlayer(content?.playbackUrl ?? "", (p) => {
    p.loop = false;
  });

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-8">
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <Ionicons name="alert-circle-outline" size={44} color="#ef4444" />
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

  if (!content) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (content.type === "DOC") {
    return (
      <View className="flex-1 bg-background px-5 pt-14">
        <StatusBar barStyle="dark-content" />
        <TouchableOpacity onPress={() => router.back()} className="mb-6">
          <Ionicons name="chevron-back" size={24} color="#0f766e" />
        </TouchableOpacity>
        <View className="items-center rounded-3xl border border-border bg-card p-8">
          <Ionicons name="document-text-outline" size={54} color="#0f766e" />
          <Text className="mt-4 text-center text-xl font-bold text-foreground">
            {content.title || title || "Document"}
          </Text>
          <Text className="mt-2 text-center text-sm text-muted-foreground">
            {content.fileName || "Chapter document"}
          </Text>
          <TouchableOpacity
            disabled={!content.fileUrl}
            onPress={() => content.fileUrl && Linking.openURL(content.fileUrl)}
            className="mt-6 rounded-full bg-emerald-600 px-6 py-3"
          >
            <Text className="font-bold text-white">Open Document</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View className="flex-row items-center px-4 pb-2 pt-14">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="flex-1 text-base font-semibold text-white" numberOfLines={1}>
          {content.title || title || "Chapter video"}
        </Text>
      </View>
      <View className="flex-1 items-center justify-center">
        {content.playbackUrl ? (
          <VideoView
            player={player}
            style={{ width: "100%", height: "100%" }}
            fullscreenOptions={{ enable: true, orientation: "landscape" }}
            allowsPictureInPicture
            nativeControls
          />
        ) : (
          <Text className="text-white/70">Video is still processing.</Text>
        )}
      </View>
      {content.isPreview ? (
        <View className="border-t border-white/10 px-4 pb-6 pt-4">
          <Text className="text-sm font-semibold text-white">Free preview</Text>
          <Text className="mt-1 text-xs leading-5 text-white/65">
            Unlock the chapter to access every item.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
