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

import * as FileSystem from "expo-file-system/legacy";
import Toast from "react-native-toast-message";

import { store } from "@/store";
import {
  addUpload,
  updateUploadProgress,
  setUploadLabel,
  completeUpload,
  failUpload,
  removeUpload,
} from "@/store/slices/uploadSlice";
import api from "@/lib/api";

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

// ── Course video → Mux (create → PUT → poll → notify) ─────────────────────
//
// Unlike the image/doc flows above, a course video has a multi-stage
// lifecycle: a DB record is created, the file is PUT to a Mux upload URL,
// then Mux transcodes it server-side. We surface the whole thing through
// the global upload overlay so the teacher can navigate freely while it
// runs, and fire a push + in-app notification the moment it's ready.

export type StartCourseVideoUploadParams = {
  courseId: string;
  sectionId: string;
  title: string;
  file: {
    uri: string;
    name: string;
    mimeType?: string;
    size?: number;
  };
  /** Called once the video DB record exists (a PROCESSING row can be shown). */
  onCreated?: () => void;
  /** Called when the video finishes processing and is ready to use. */
  onReady?: () => void;
  /** Called if the upload or processing fails. */
  onError?: (error: string) => void;
};

const PROCESSING_POLL_INTERVAL_MS = 5000;
const PROCESSING_MAX_ATTEMPTS = 120; // ~10 minutes

/**
 * Start a background course-video upload. Returns immediately with the upload
 * id; the caller (Add Video modal) can close right away. Progress and the
 * final "ready" notification are handled globally.
 */
export function startCourseVideoUpload(params: StartCourseVideoUploadParams): string {
  const id = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const label = `📹 ${params.title}`;

  store.dispatch(
    addUpload({
      id,
      uri: params.file.uri,
      type: "file",
      label,
      courseId: params.courseId,
      sectionId: params.sectionId,
      videoTitle: params.title,
    }),
  );

  performCourseVideoUpload(id, params).catch((err) => {
    console.error("[CourseVideoUpload] Unhandled error:", err);
  });

  return id;
}

export type StartChapterVideoUploadParams = {
  chapterId: string;
  title: string;
  file: {
    uri: string;
    name: string;
    mimeType?: string;
    size?: number;
  };
  onCreated?: () => void;
  onReady?: () => void;
  onError?: (error: string) => void;
};

export function startChapterVideoUpload(params: StartChapterVideoUploadParams): string {
  const id = `chvid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const label = `📹 ${params.title}`;

  store.dispatch(
    addUpload({
      id,
      uri: params.file.uri,
      type: "file",
      label,
      videoTitle: params.title,
    }),
  );

  performChapterVideoUpload(id, params).catch((err) => {
    console.error("[ChapterVideoUpload] Unhandled error:", err);
  });

  return id;
}

// ── Notice video → Mux (admin) ────────────────────────────────────────────
//
// Notice videos aren't tied to a course/chapter content record. We create a
// Mux direct upload, PUT the file, poll for the playback URL, then hand that
// URL back so the notice create call can persist it as `videoUrl`.

export type StartNoticeVideoUploadParams = {
  title: string;
  file: {
    uri: string;
    name: string;
    mimeType?: string;
    size?: number;
  };
  /** Called with the HLS playback URL once the asset is ready. */
  onReady?: (playbackUrl: string) => void;
  onError?: (error: string) => void;
};

export function startNoticeVideoUpload(params: StartNoticeVideoUploadParams): string {
  const id = `ntvid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  store.dispatch(
    addUpload({ id, uri: params.file.uri, type: "file", label: `📹 ${params.title}` }),
  );
  performNoticeVideoUpload(id, params).catch((err) => {
    console.error("[NoticeVideoUpload] Unhandled error:", err);
  });
  return id;
}

async function performNoticeVideoUpload(
  id: string,
  params: StartNoticeVideoUploadParams,
) {
  const { title, file } = params;
  try {
    store.dispatch(updateUploadProgress({ id, progress: 2 }));

    const createRes = await api.post("/mobile/admin/notices/upload-video");
    const uploadUrl: string = createRes.data?.uploadUrl;
    const uploadId: string | undefined = createRes.data?.uploadId;
    if (!uploadUrl || !uploadId) {
      throw new Error("Server did not return an upload URL.");
    }

    store.dispatch(updateUploadProgress({ id, progress: 5 }));

    const uploadTask = FileSystem.createUploadTask(
      uploadUrl,
      file.uri,
      {
        httpMethod: "PUT",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { "Content-Type": file.mimeType || "video/mp4" },
      },
      (progress) => {
        if (progress.totalBytesExpectedToSend > 0) {
          const pct = Math.round(
            5 + (progress.totalBytesSent / progress.totalBytesExpectedToSend) * 85,
          );
          store.dispatch(updateUploadProgress({ id, progress: pct }));
        }
      },
    );

    const result = await uploadTask.uploadAsync();
    if (!result || result.status < 200 || result.status >= 300) {
      throw new Error(`Upload failed (HTTP ${result?.status ?? "unknown"})`);
    }

    store.dispatch(updateUploadProgress({ id, progress: 95 }));
    store.dispatch(setUploadLabel({ id, label: `📹 ${title} · Processing…` }));

    for (let attempt = 0; attempt < PROCESSING_MAX_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, PROCESSING_POLL_INTERVAL_MS));
      try {
        const res = await api.get(
          `/mobile/admin/notices/upload-video/${uploadId}/status`,
        );
        const status = res.data?.status;
        const playbackUrl = res.data?.playbackUrl;
        if (status === "ready" && playbackUrl) {
          store.dispatch(completeUpload({ id, url: playbackUrl }));
          setTimeout(() => store.dispatch(removeUpload(id)), 5000);
          params.onReady?.(playbackUrl);
          return;
        }
        if (status === "errored") {
          throw new Error("Processing failed on the server.");
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("Processing failed")) {
          store.dispatch(failUpload({ id, error: err.message }));
          params.onError?.(err.message);
          Toast.show({ type: "error", text1: "Video processing failed" });
          return;
        }
      }
    }

    const timeoutMsg = "Timed out waiting for the video to finish processing.";
    store.dispatch(failUpload({ id, error: timeoutMsg }));
    params.onError?.(timeoutMsg);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Upload failed";
    store.dispatch(failUpload({ id, error: errMsg }));
    params.onError?.(errMsg);
    Toast.show({ type: "error", text1: "Video upload failed", text2: errMsg });
  }
}

async function performChapterVideoUpload(
  id: string,
  params: StartChapterVideoUploadParams,
) {
  const { chapterId, title, file } = params;
  try {
    store.dispatch(updateUploadProgress({ id, progress: 2 }));

    const createRes = await api.post(`/chapters/${chapterId}/contents`, {
      type: "VIDEO",
      title: title.trim(),
    });
    const uploadUrl: string = createRes.data?.uploadUrl;
    const contentId: string | undefined = createRes.data?.content?._id;
    if (!uploadUrl || !contentId) {
      throw new Error("Server did not return an upload URL.");
    }

    params.onCreated?.();
    store.dispatch(updateUploadProgress({ id, progress: 5 }));

    const uploadTask = FileSystem.createUploadTask(
      uploadUrl,
      file.uri,
      {
        httpMethod: "PUT",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { "Content-Type": file.mimeType || "video/mp4" },
      },
      (progress) => {
        if (progress.totalBytesExpectedToSend > 0) {
          const pct = Math.round(
            5 + (progress.totalBytesSent / progress.totalBytesExpectedToSend) * 85,
          );
          store.dispatch(updateUploadProgress({ id, progress: pct }));
        }
      },
    );

    const result = await uploadTask.uploadAsync();
    if (!result || result.status < 200 || result.status >= 300) {
      throw new Error(`Upload failed (HTTP ${result?.status ?? "unknown"})`);
    }

    store.dispatch(updateUploadProgress({ id, progress: 95 }));
    store.dispatch(setUploadLabel({ id, label: `📹 ${title} · Processing…` }));

    await pollChapterContentProcessing(id, params, contentId);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Upload failed";
    store.dispatch(failUpload({ id, error: errMsg }));
    params.onError?.(errMsg);
    Toast.show({ type: "error", text1: "Video upload failed", text2: errMsg });
  }
}

async function pollChapterContentProcessing(
  id: string,
  params: StartChapterVideoUploadParams,
  contentId: string,
) {
  const { chapterId } = params;

  for (let attempt = 0; attempt < PROCESSING_MAX_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, PROCESSING_POLL_INTERVAL_MS));
    try {
      const res = await api.get(`/chapters/${chapterId}/contents/${contentId}/status`);
      const status = res.data?.status;
      if (status === "READY") {
        store.dispatch(completeUpload({ id, url: contentId }));
        setTimeout(() => store.dispatch(removeUpload(id)), 5000);
        params.onReady?.();
        return;
      }
      if (status === "ERRORED") {
        throw new Error("Processing failed on the server.");
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("Processing failed")) {
        store.dispatch(failUpload({ id, error: err.message }));
        params.onError?.(err.message);
        Toast.show({ type: "error", text1: "Video processing failed" });
        return;
      }
    }
  }

  const timeoutMsg = "Timed out waiting for the video to finish processing.";
  store.dispatch(failUpload({ id, error: timeoutMsg }));
  params.onError?.(timeoutMsg);
}

async function performCourseVideoUpload(
  id: string,
  params: StartCourseVideoUploadParams,
) {
  const { courseId, sectionId, title, file } = params;
  try {
    store.dispatch(updateUploadProgress({ id, progress: 2 }));

    // 1. Create the video record → returns a Mux direct-upload URL.
    const createRes = await api.post(`/courses/${courseId}/videos`, {
      title: title.trim(),
      sectionId,
    });
    const uploadUrl: string = createRes.data?.uploadUrl;
    const videoId: string | undefined = createRes.data?.video?._id;
    if (!uploadUrl || !videoId) {
      throw new Error("Server did not return an upload URL.");
    }

    // The record exists now — let the studio show a PROCESSING placeholder.
    params.onCreated?.();

    store.dispatch(updateUploadProgress({ id, progress: 5 }));

    // 2. Stream the file straight from disk to Mux. expo-file-system uploads
    //    natively on a background session — it never reads the whole video
    //    into a JS Blob, so even large files can't spike memory or block the
    //    UI thread, and the transfer survives the app being backgrounded.
    //    Map upload bytes to 5-90% so the bar still moves before processing.
    const uploadTask = FileSystem.createUploadTask(
      uploadUrl,
      file.uri,
      {
        httpMethod: "PUT",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { "Content-Type": file.mimeType || "video/mp4" },
      },
      (progress) => {
        if (progress.totalBytesExpectedToSend > 0) {
          const pct = Math.round(
            5 + (progress.totalBytesSent / progress.totalBytesExpectedToSend) * 85,
          );
          store.dispatch(updateUploadProgress({ id, progress: pct }));
        }
      },
    );

    const result = await uploadTask.uploadAsync();
    if (!result || result.status < 200 || result.status >= 300) {
      throw new Error(`Upload failed (HTTP ${result?.status ?? "unknown"})`);
    }

    // 3. Uploaded — now Mux transcodes. Hold near-complete and switch the
    //    overlay label to "Processing…" while we poll.
    store.dispatch(updateUploadProgress({ id, progress: 95 }));
    store.dispatch(setUploadLabel({ id, label: `📹 ${title} · Processing…` }));

    await pollCourseVideoProcessing(id, params, videoId);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Upload failed";
    store.dispatch(failUpload({ id, error: errMsg }));
    params.onError?.(errMsg);
    Toast.show({ type: "error", text1: "Video upload failed", text2: errMsg });
  }
}

async function pollCourseVideoProcessing(
  id: string,
  params: StartCourseVideoUploadParams,
  videoId: string,
) {
  const { courseId } = params;

  for (let attempt = 0; attempt < PROCESSING_MAX_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, PROCESSING_POLL_INTERVAL_MS));
    try {
      // The status endpoint flips the video READY server-side and, on that
      // transition, persists + pushes the "video ready" notification to the
      // teacher (same path the Mux webhook uses). We just react to the result.
      const res = await api.get(`/courses/${courseId}/videos/${videoId}/status`);
      const status = res.data?.status;
      if (status === "READY") {
        store.dispatch(completeUpload({ id, url: videoId }));
        setTimeout(() => store.dispatch(removeUpload(id)), 5000);
        params.onReady?.();
        return;
      }
      if (status === "ERRORED") {
        throw new Error("Processing failed on the server.");
      }
      // Otherwise still processing — keep polling.
    } catch (err) {
      // Transient network blips shouldn't kill the job; only give up on an
      // explicit server-side processing failure.
      if (err instanceof Error && err.message.includes("Processing failed")) {
        store.dispatch(failUpload({ id, error: err.message }));
        params.onError?.(err.message);
        Toast.show({ type: "error", text1: "Video processing failed" });
        return;
      }
    }
  }

  const timeoutMsg = "Timed out waiting for the video to finish processing.";
  store.dispatch(failUpload({ id, error: timeoutMsg }));
  params.onError?.(timeoutMsg);
}
