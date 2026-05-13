/**
 * Mobile Upload Manager
 *
 * Performs background file uploads and dispatches progress to the Redux
 * upload slice. The GlobalUploadOverlay component reads from Redux to
 * show real-time progress.
 *
 * Upload routing:
 *  - Images → Cloudinary via /api/upload (server-side)
 *  - Docs   → R2 via presigned URL (/api/upload/presign → PUT to R2)
 */

import { store } from "@/store";
import {
  addUpload,
  updateUploadProgress,
  completeUpload,
  failUpload,
  removeUpload,
} from "@/store/slices/uploadSlice";
import api, { API_BASE_URL } from "@/lib/api";

export type StartMobileUploadParams = {
  file: {
    uri: string;
    name: string;
    mimeType?: string;
    size?: number;
  };
  /** Human-readable label shown in the overlay (e.g. "Note: Physics Ch1") */
  label: string;
  /** Override: "image" or "raw" (document). Auto-detected from mimeType if omitted. */
  fileType?: "image" | "file";
  /** R2 folder for document uploads (default: "documents") */
  folder?: string;
  /** Called with the final URL when upload completes */
  onComplete?: (url: string) => void;
  /** Called on error */
  onError?: (error: string) => void;
};

/**
 * Start a background upload. Returns the upload ID immediately.
 * The modal/screen can close right away — progress shows in the global overlay.
 */
export function startMobileUpload(params: StartMobileUploadParams): string {
  const id = `upl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const isImage =
    params.fileType === "image" ||
    (!params.fileType && (params.file.mimeType || "").startsWith("image/"));

  store.dispatch(
    addUpload({
      id,
      uri: params.file.uri,
      type: isImage ? "image" : "file",
      label: params.label,
    }),
  );

  performUpload(id, params, isImage).catch((err) => {
    console.error("[MobileUploadManager] Unhandled error:", err);
  });

  return id;
}

// ── Internal ──────────────────────────────────────────────────────────────

async function performUpload(
  id: string,
  params: StartMobileUploadParams,
  isImage: boolean,
) {
  try {
    let url: string;

    if (isImage) {
      url = await uploadImageViaCloudinary(id, params);
    } else {
      url = await uploadDocViaR2(id, params);
    }

    store.dispatch(completeUpload({ id, url }));
    params.onComplete?.(url);

    // Auto-clear after 5 seconds
    setTimeout(() => {
      store.dispatch(removeUpload(id));
    }, 5000);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Upload failed";
    store.dispatch(failUpload({ id, error: errMsg }));
    params.onError?.(errMsg);
  }
}

// ── Image → Cloudinary via /api/upload ────────────────────────────────────

async function uploadImageViaCloudinary(
  id: string,
  params: StartMobileUploadParams,
): Promise<string> {
  store.dispatch(updateUploadProgress({ id, progress: 5 }));

  const formData = new FormData();
  // @ts-ignore — RN FormData accepts object with uri/type/name
  formData.append("file", {
    uri: params.file.uri,
    type: params.file.mimeType || "image/jpeg",
    name: params.file.name,
  });

  const res = await api.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120000,
    onUploadProgress: (evt) => {
      if (evt.total && evt.total > 0) {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        store.dispatch(updateUploadProgress({ id, progress: pct }));
      }
    },
  });

  store.dispatch(updateUploadProgress({ id, progress: 100 }));
  return res.data.secure_url;
}

// ── Document → R2 via presigned URL ──────────────────────────────────────

async function uploadDocViaR2(
  id: string,
  params: StartMobileUploadParams,
): Promise<string> {
  store.dispatch(updateUploadProgress({ id, progress: 2 }));

  // 1. Get presigned URL
  const presignRes = await api.post("/upload/presign", {
    filename: params.file.name,
    contentType: params.file.mimeType || "application/octet-stream",
    fileSize: params.file.size,
    folder: params.folder || "documents",
  });

  const { uploadUrl, publicUrl } = presignRes.data;

  store.dispatch(updateUploadProgress({ id, progress: 10 }));

  // 2. PUT directly to R2 using XMLHttpRequest for progress
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (evt) => {
      if (evt.lengthComputable) {
        // Map progress from 10-100
        const rawPct = evt.loaded / evt.total;
        const pct = Math.round(10 + rawPct * 90);
        store.dispatch(updateUploadProgress({ id, progress: pct }));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload."));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload cancelled."));
    });

    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader(
      "Content-Type",
      params.file.mimeType || "application/octet-stream",
    );

    // For React Native, we need to fetch the file blob
    fetch(params.file.uri)
      .then((r) => r.blob())
      .then((blob) => {
        xhr.send(blob);
      })
      .catch(reject);
  });

  return publicUrl;
}
