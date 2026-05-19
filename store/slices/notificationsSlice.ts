import { createSlice, PayloadAction } from "@reduxjs/toolkit";

/**
 * In-app notification center state.
 *
 * Distinct from `realtimeSlice.notifications` (which is a transient toast-feed
 * cache for the live Pusher socket). This slice mirrors the server's persistent
 * `Notification` collection so the user can scroll their history, mark as
 * read, and tap to navigate even after restarting the app.
 */

export interface AppNotification {
  id: string;
  type: string;
  message: string;
  href: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsState {
  list: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  loadedForUserId: string | null;
}

const NOTIFICATIONS_CACHE_TTL_MS = 60 * 1000;

const initialState: NotificationsState = {
  list: [],
  unreadCount: 0,
  isLoading: false,
  isRefreshing: false,
  error: null,
  lastFetchedAt: null,
  loadedForUserId: null,
};

function recomputeUnread(list: AppNotification[]): number {
  return list.reduce((sum, n) => (n.isRead ? sum : sum + 1), 0);
}

const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    setNotificationsLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
      if (action.payload) state.error = null;
    },
    setNotificationsRefreshing(state, action: PayloadAction<boolean>) {
      state.isRefreshing = action.payload;
    },
    setNotificationsError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
      state.isRefreshing = false;
    },
    setNotifications(
      state,
      action: PayloadAction<{ list: AppNotification[]; userId: string }>,
    ) {
      state.list = action.payload.list;
      state.unreadCount = recomputeUnread(action.payload.list);
      state.lastFetchedAt = Date.now();
      state.loadedForUserId = action.payload.userId;
      state.error = null;
    },
    /** Prepend a fresh notification (from a live Pusher event). De-dupes by id. */
    prependNotification(state, action: PayloadAction<AppNotification>) {
      const exists = state.list.some((n) => n.id === action.payload.id);
      if (exists) return;
      state.list = [action.payload, ...state.list].slice(0, 100);
      if (!action.payload.isRead) state.unreadCount += 1;
    },
    /** Mark a single notification as read (optimistic; reducer is the source of truth). */
    markNotificationRead(state, action: PayloadAction<string>) {
      const target = state.list.find((n) => n.id === action.payload);
      if (target && !target.isRead) {
        target.isRead = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    markAllRead(state) {
      for (const n of state.list) n.isRead = true;
      state.unreadCount = 0;
    },
    clearNotifications(state) {
      state.list = [];
      state.unreadCount = 0;
      state.isLoading = false;
      state.isRefreshing = false;
      state.error = null;
      state.lastFetchedAt = null;
      state.loadedForUserId = null;
    },
  },
});

export const {
  setNotificationsLoading,
  setNotificationsRefreshing,
  setNotificationsError,
  setNotifications,
  prependNotification,
  markNotificationRead,
  markAllRead,
  clearNotifications,
} = notificationsSlice.actions;

export const selectIsNotificationsStale = (lastFetchedAt: number | null) =>
  !lastFetchedAt || Date.now() - lastFetchedAt > NOTIFICATIONS_CACHE_TTL_MS;

export default notificationsSlice.reducer;
