import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UploadItem {
  id: string;
  uri: string;
  type: "image" | "file";
  /** Human-readable label shown in the upload overlay */
  label?: string;
  /**
   * Set for course-video uploads so the studio can show an accurate
   * "Uploading… X%" status on the matching curriculum row (correlated by
   * courseId + sectionId + videoTitle).
   */
  courseId?: string;
  sectionId?: string;
  videoTitle?: string;
  progress: number;
  url?: string;
  error?: string;
  status: "pending" | "uploading" | "done" | "failed";
}

interface UploadState {
  uploads: UploadItem[];
}

const initialState: UploadState = {
  uploads: [],
};

const uploadSlice = createSlice({
  name: "upload",
  initialState,
  reducers: {
    addUpload(state, action: PayloadAction<Omit<UploadItem, "progress" | "status">>) {
      state.uploads.push({
        ...action.payload,
        progress: 0,
        status: "pending",
      });
    },
    updateUploadProgress(state, action: PayloadAction<{ id: string; progress: number }>) {
      const upload = state.uploads.find((u) => u.id === action.payload.id);
      if (upload) {
        upload.progress = action.payload.progress;
        upload.status = "uploading";
      }
    },
    setUploadLabel(state, action: PayloadAction<{ id: string; label: string }>) {
      const upload = state.uploads.find((u) => u.id === action.payload.id);
      if (upload) {
        upload.label = action.payload.label;
      }
    },
    completeUpload(state, action: PayloadAction<{ id: string; url: string }>) {
      const upload = state.uploads.find((u) => u.id === action.payload.id);
      if (upload) {
        upload.url = action.payload.url;
        upload.progress = 100;
        upload.status = "done";
      }
    },
    failUpload(state, action: PayloadAction<{ id: string; error: string }>) {
      const upload = state.uploads.find((u) => u.id === action.payload.id);
      if (upload) {
        upload.error = action.payload.error;
        upload.status = "failed";
      }
    },
    removeUpload(state, action: PayloadAction<string>) {
      state.uploads = state.uploads.filter((u) => u.id !== action.payload);
    },
    clearUploads(state) {
      state.uploads = [];
    },
  },
});

export const {
  addUpload,
  updateUploadProgress,
  setUploadLabel,
  completeUpload,
  failUpload,
  removeUpload,
  clearUploads,
} = uploadSlice.actions;
export default uploadSlice.reducer;
