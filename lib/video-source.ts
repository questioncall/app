// Onboarding (and other) videos are entered as a free-form URL by an admin.
// The native expo-video player can only decode direct media streams
// (mp4/webm/mov/HLS). YouTube/Vimeo "watch" URLs are HTML pages, not media, so
// they must be played through an embedded iframe player instead. This helper
// classifies a URL and, for embeds, returns the iframe-ready player URL.

export type VideoSourceKind = "youtube" | "vimeo" | "file";

export interface ParsedVideoSource {
  kind: VideoSourceKind;
  /** For "file": the original direct media URL. For embeds: the iframe src. */
  url: string;
  /** The original, untouched input. */
  original: string;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match?.[1] ?? null;
}

export function parseVideoSource(rawUrl: string | null | undefined): ParsedVideoSource {
  const original = (rawUrl ?? "").trim();
  if (!original) return { kind: "file", url: "", original };

  const youtubeId = extractYouTubeId(original);
  if (youtubeId) {
    return {
      kind: "youtube",
      url: `https://www.youtube.com/embed/${youtubeId}?playsinline=1&rel=0&modestbranding=1`,
      original,
    };
  }

  const vimeoId = extractVimeoId(original);
  if (vimeoId) {
    return {
      kind: "vimeo",
      url: `https://player.vimeo.com/video/${vimeoId}`,
      original,
    };
  }

  return { kind: "file", url: original, original };
}

export function isEmbeddedVideoSource(rawUrl: string | null | undefined): boolean {
  return parseVideoSource(rawUrl).kind !== "file";
}
