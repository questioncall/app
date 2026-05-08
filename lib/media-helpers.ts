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
