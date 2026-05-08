import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type OnboardingRole = "STUDENT" | "TEACHER" | "ADMIN";

export interface OnboardingVideo {
  id?: string;
  role: OnboardingRole;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  isActive: boolean;
}

interface OnboardingState {
  shouldShow: boolean;
  role: OnboardingRole | null;
  video: OnboardingVideo | null;
  isLoading: boolean;
  isDismissing: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  loadedForUserId: string | null;
}

const initialState: OnboardingState = {
  shouldShow: false,
  role: null,
  video: null,
  isLoading: false,
  isDismissing: false,
  error: null,
  lastFetchedAt: null,
  loadedForUserId: null,
};

const onboardingSlice = createSlice({
  name: "onboarding",
  initialState,
  reducers: {
    setOnboardingLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setOnboardingDismissing(state, action: PayloadAction<boolean>) {
      state.isDismissing = action.payload;
    },
    setOnboardingError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.isLoading = false;
      state.isDismissing = false;
    },
    setOnboardingData(
      state,
      action: PayloadAction<{
        shouldShow: boolean;
        role: OnboardingRole | null;
        video: OnboardingVideo | null;
        userId: string | null;
      }>,
    ) {
      state.shouldShow = action.payload.shouldShow;
      state.role = action.payload.role;
      state.video = action.payload.video;
      state.loadedForUserId = action.payload.userId;
      state.lastFetchedAt = Date.now();
      state.isLoading = false;
      state.error = null;
    },
    markOnboardingSeen(state) {
      state.shouldShow = false;
      state.isDismissing = false;
    },
    clearOnboarding(state) {
      state.shouldShow = false;
      state.role = null;
      state.video = null;
      state.isLoading = false;
      state.isDismissing = false;
      state.error = null;
      state.lastFetchedAt = null;
      state.loadedForUserId = null;
    },
  },
});

export const {
  setOnboardingLoading,
  setOnboardingDismissing,
  setOnboardingError,
  setOnboardingData,
  markOnboardingSeen,
  clearOnboarding,
} = onboardingSlice.actions;

export default onboardingSlice.reducer;
