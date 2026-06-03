import { useState } from "react";
import { Image } from "expo-image";

type NoticeImageProps = {
  uri: string;
  width: number;
  borderColor?: string;
  borderRadius?: number;
};

// Renders a notice image at its natural aspect ratio so banners and portrait
// posters both display without cropping or letterboxing. The ratio is clamped
// so an extreme image can't make the card absurdly tall/short — in that rare
// case `cover` trims gently instead of leaving empty bars.
const MIN_RATIO = 0.6; // tallest allowed (portrait) → height ≈ 1.67 × width
const MAX_RATIO = 2.4; // widest allowed (banner)

export function NoticeImage({
  uri,
  width,
  borderColor,
  borderRadius = 16,
}: NoticeImageProps) {
  // width / height. Start at 16:9 until the real size loads.
  const [ratio, setRatio] = useState(16 / 9);

  const clamped = Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));
  const height = width / clamped;
  const wasClamped = clamped !== ratio;

  return (
    <Image
      source={{ uri }}
      style={{
        width,
        height,
        borderRadius,
        borderWidth: borderColor ? 1 : 0,
        borderColor,
        backgroundColor: "rgba(0,0,0,0.04)",
      }}
      // When the natural ratio fits the box exactly, contain == cover (no
      // crop, no bars). Only clamped extremes fall back to a gentle crop.
      contentFit={wasClamped ? "cover" : "contain"}
      transition={200}
      onLoad={(event) => {
        const source = event.source;
        if (source?.width && source?.height) {
          setRatio(source.width / source.height);
        }
      }}
    />
  );
}
