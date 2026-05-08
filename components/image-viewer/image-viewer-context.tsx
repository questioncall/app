import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { ImageViewerModal } from "./image-viewer-modal";

type ImageViewerContextValue = {
  /** Open a fullscreen, zoomable image viewer over the current screen. */
  openImageViewer: (uri: string) => void;
};

// No-op fallback when consumers render outside the provider — keeps tests and
// preview screens from crashing.
const ImageViewerContext = createContext<ImageViewerContextValue>({
  openImageViewer: () => {},
});

export function ImageViewerProvider({ children }: { children: ReactNode }) {
  const [uri, setUri] = useState<string | null>(null);

  const openImageViewer = useCallback((next: string) => {
    setUri(next);
  }, []);

  const closeImageViewer = useCallback(() => {
    setUri(null);
  }, []);

  return (
    <ImageViewerContext.Provider value={{ openImageViewer }}>
      {children}
      <ImageViewerModal visible={Boolean(uri)} uri={uri} onClose={closeImageViewer} />
    </ImageViewerContext.Provider>
  );
}

export function useImageViewer() {
  return useContext(ImageViewerContext);
}
