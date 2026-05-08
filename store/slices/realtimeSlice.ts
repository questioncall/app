import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type RealtimeStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "unavailable"
  | "error";

export interface RealtimeNotification {
  id: string;
  type: string;
  message: string;
  href?: string | null;
  isRead?: boolean;
  createdAt?: string;
}

interface RealtimeState {
  status: RealtimeStatus;
  userChannelName: string | null;
  reconnectAttempts: number;
  lastConnectedAt: number | null;
  error: string | null;
  notifications: RealtimeNotification[];
}

const initialState: RealtimeState = {
  status: "idle",
  userChannelName: null,
  reconnectAttempts: 0,
  lastConnectedAt: null,
  error: null,
  notifications: [],
};

const realtimeSlice = createSlice({
  name: "realtime",
  initialState,
  reducers: {
    setRealtimeStatus(
      state,
      action: PayloadAction<{
        status: RealtimeStatus;
        error?: string | null;
      }>,
    ) {
      state.status = action.payload.status;
      state.error = action.payload.error ?? null;
      if (action.payload.status === "connected") {
        state.reconnectAttempts = 0;
        state.lastConnectedAt = Date.now();
      }
    },
    setRealtimeUserChannel(state, action: PayloadAction<string | null>) {
      state.userChannelName = action.payload;
    },
    setRealtimeReconnectAttempts(state, action: PayloadAction<number>) {
      state.reconnectAttempts = action.payload;
    },
    addRealtimeNotification(state, action: PayloadAction<RealtimeNotification>) {
      const exists = state.notifications.some(
        (notification) => notification.id === action.payload.id,
      );
      if (!exists) {
        state.notifications = [action.payload, ...state.notifications].slice(0, 50);
      }
    },
    clearRealtime(state) {
      state.status = "idle";
      state.userChannelName = null;
      state.reconnectAttempts = 0;
      state.lastConnectedAt = null;
      state.error = null;
      state.notifications = [];
    },
  },
});

export const {
  setRealtimeStatus,
  setRealtimeUserChannel,
  setRealtimeReconnectAttempts,
  addRealtimeNotification,
  clearRealtime,
} = realtimeSlice.actions;

export default realtimeSlice.reducer;
