import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type NoticeType = "ADVERTISEMENT" | "GENERAL" | "SPECIAL";
export type NoticeAudience = "ALL" | "TEACHER" | "STUDENT" | "SPECIFIC";

export interface AppNotice {
  _id: string;
  title: string;
  body: string;
  type: NoticeType;
  targetAudience: NoticeAudience;
  expiresAt?: string | null;
  createdAt?: string;
}

export interface NoticesState {
  list: AppNotice[];
  activeNoticeId: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  loadedForUserId: string | null;
}

const NOTICE_PRIORITY: Record<NoticeType, number> = {
  SPECIAL: 3,
  ADVERTISEMENT: 2,
  GENERAL: 1,
};

function sortNotices(notices: AppNotice[]) {
  return [...notices].sort((left, right) => {
    const priorityDelta =
      (NOTICE_PRIORITY[right.type] ?? 0) - (NOTICE_PRIORITY[left.type] ?? 0);
    if (priorityDelta !== 0) return priorityDelta;
    return Date.parse(right.createdAt ?? "") - Date.parse(left.createdAt ?? "");
  });
}

const initialState: NoticesState = {
  list: [],
  activeNoticeId: null,
  isLoading: false,
  isRefreshing: false,
  error: null,
  lastFetchedAt: null,
  loadedForUserId: null,
};

const noticesSlice = createSlice({
  name: "notices",
  initialState,
  reducers: {
    setNoticesLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setNoticesRefreshing(state, action: PayloadAction<boolean>) {
      state.isRefreshing = action.payload;
    },
    setNoticesError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.isLoading = false;
      state.isRefreshing = false;
    },
    setNotices(
      state,
      action: PayloadAction<{
        notices: AppNotice[];
        userId: string | null;
        activateModal?: boolean;
      }>,
    ) {
      const sorted = sortNotices(action.payload.notices);
      state.list = sorted;
      state.loadedForUserId = action.payload.userId;
      state.lastFetchedAt = Date.now();
      state.isLoading = false;
      state.isRefreshing = false;
      state.error = null;

      if (action.payload.activateModal !== false) {
        state.activeNoticeId = sorted[0]?._id ?? null;
      } else if (
        state.activeNoticeId &&
        !sorted.some((notice) => notice._id === state.activeNoticeId)
      ) {
        state.activeNoticeId = null;
      }
    },
    setActiveNotice(state, action: PayloadAction<string | null>) {
      state.activeNoticeId = action.payload;
    },
    dismissNoticeLocally(state, action: PayloadAction<string>) {
      state.list = state.list.filter((notice) => notice._id !== action.payload);
      state.activeNoticeId =
        state.activeNoticeId === action.payload
          ? (state.list[0]?._id ?? null)
          : state.activeNoticeId;
    },
    clearNotices(state) {
      state.list = [];
      state.activeNoticeId = null;
      state.isLoading = false;
      state.isRefreshing = false;
      state.error = null;
      state.lastFetchedAt = null;
      state.loadedForUserId = null;
    },
  },
});

export const {
  setNoticesLoading,
  setNoticesRefreshing,
  setNoticesError,
  setNotices,
  setActiveNotice,
  dismissNoticeLocally,
  clearNotices,
} = noticesSlice.actions;

export default noticesSlice.reducer;
