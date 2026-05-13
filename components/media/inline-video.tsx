import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";

type InlineVideoProps = {
  uri: string;
  width: number;
  height: number;
  borderColor?: string;
  borderRadius?: number;
};

export function InlineVideo({
  uri,
  width,
  height,
  borderColor,
  borderRadius = 12,
}: InlineVideoProps) {
  const [activated, setActivated] = useState(false);

  if (!activated) {
    return (
      <Pressable
        onPress={() => setActivated(true)}
        style={{
          width,
          height,
          borderRadius,
          overflow: "hidden",
          borderWidth: borderColor ? 1 : 0,
          borderColor,
          backgroundColor: "#0f172a",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "rgba(255,255,255,0.18)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name="play"
            size={22}
            color="#fff"
            style={{ marginLeft: 2 /* optical centering */ }}
          />
        </View>
      </Pressable>
    );
  }

  return (
    <ActiveVideo
      uri={uri}
      width={width}
      height={height}
      borderColor={borderColor}
      borderRadius={borderRadius}
    />
  );
}

function ActiveVideo({
  uri,
  width,
  height,
  borderColor,
  borderRadius,
}: Required<Omit<InlineVideoProps, "borderColor">> & { borderColor?: string }) {
  // useVideoPlayer is the new expo-video hook (v3+). Plays HLS (.m3u8) and
  // mp4/webm/mov natively on Android and iOS — covers both Mux playback URLs
  // and Cloudinary /video/upload assets.
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  return (
    <View
      style={{
        width,
        height,
        borderRadius,
        overflow: "hidden",
        borderWidth: borderColor ? 1 : 0,
        borderColor,
        backgroundColor: "#000",
      }}
    >
      <VideoView
        player={player}
        style={{ width, height }}
        contentFit="cover"
        fullscreenOptions={{ enable: true, orientation: "landscape" }}
        nativeControls
      />
    </View>
  );
}
