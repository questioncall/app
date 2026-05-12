// Detects whether a media URL points at a video so the feed can render the
// right component (InlineVideo vs Image). Mirrors the web's detection in
// web/app/(workspace)/question/[id]/page.tsx but extended to also catch Mux
// playback URLs and HLS manifests.
const VIDEO_EXT_RX = /\.(mp4|webm|mov|m4v|m3u8)(\?.*)?$/i;
const VIDEO_HOSTS_OR_PATHS = [
  "stream.mux.com", // Mux HLS manifest
  "/video/upload/", // Cloudinary video resource type
];

export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (VIDEO_EXT_RX.test(url)) return true;
  return VIDEO_HOSTS_OR_PATHS.some((needle) => url.includes(needle));
}

const AUDIO_EXT_RX = /\.(mp3|m4a|wav|ogg|flac|aac|opus)(\?.*)?$/i;

export function isAudioUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return AUDIO_EXT_RX.test(url);
}

const DOC_EXT_RX = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv)(\?.*)?$/i;

export function isDocumentUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return DOC_EXT_RX.test(url);
}

export type MediaKind = "video" | "audio" | "document" | "image";

export function getMediaKind(url: string | null | undefined): MediaKind {
  if (isVideoUrl(url)) return "video";
  if (isAudioUrl(url)) return "audio";
  if (isDocumentUrl(url)) return "document";
  return "image";
}
