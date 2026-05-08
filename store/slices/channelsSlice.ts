import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface ChannelListItem {
  _id: string;
  questionId: string;
  questionTitle?: string;
  participants: string[];
  status: "ACTIVE" | "CLOSED" | "EXPIRED";
  lastMessage?: {
    content: string;
    senderId: string;
    createdAt: string;
  };
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  teacherId: string;
  studentId: string;
  teacherName?: string;
  studentName?: string;
}

interface ChannelsState {
  list: ChannelListItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  loadedForUserId: string | null;
}

const CHANNELS_CACHE_TTL_MS = 60 * 1000;

const initialState: ChannelsState = {
  list: [],
  isLoading: false,
  isRefreshing: false,
  error: null,
  lastFetchedAt: null,
  loadedForUserId: null,
};

const channelsSlice = createSlice({
  name: "channels",
  initialState,
  reducers: {
    setChannels(
      state,
      action: PayloadAction<{
        channels: ChannelListItem[];
        userId: string | null;
      }>,
    ) {
      state.list = action.payload.channels;
      state.lastFetchedAt = Date.now();
      state.loadedForUserId = action.payload.userId;
      state.isLoading = false;
      state.isRefreshing = false;
      state.error = null;
    },
    upsertChannel(state, action: PayloadAction<ChannelListItem>) {
      const index = state.list.findIndex((c) => c._id === action.payload._id);
      if (index === -1) {
        state.list = [action.payload, ...state.list];
      } else {
        state.list[index] = { ...state.list[index], ...action.payload };
      }
    },
    updateChannelLastMessage(
      state,
      action: PayloadAction<{
        channelId: string;
        lastMessage: ChannelListItem["lastMessage"];
        unreadCount?: number;
      }>,
    ) {
      const channel = state.list.find((c) => c._id === action.payload.channelId);
      if (channel) {
        channel.lastMessage = action.payload.lastMessage;
        if (action.payload.unreadCount !== undefined) {
          channel.unreadCount = action.payload.unreadCount;
        }
      }
    },
    markChannelRead(state, action: PayloadAction<string>) {
      const channel = state.list.find((c) => c._id === action.payload);
      if (channel) channel.unreadCount = 0;
    },
    removeChannel(state, action: PayloadAction<string>) {
      state.list = state.list.filter((c) => c._id !== action.payload);
    },
    setChannelsLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setChannelsRefreshing(state, action: PayloadAction<boolean>) {
      state.isRefreshing = action.payload;
    },
    setChannelsError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearChannelsCache(state) {
      state.list = [];
      state.lastFetchedAt = null;
      state.loadedForUserId = null;
      state.error = null;
      state.isLoading = false;
      state.isRefreshing = false;
    },
  },
});

export const {
  setChannels,
  upsertChannel,
  updateChannelLastMessage,
  markChannelRead,
  removeChannel,
  setChannelsLoading,
  setChannelsRefreshing,
  setChannelsError,
  clearChannelsCache,
} = channelsSlice.actions;

export const selectIsChannelsStale = (lastFetchedAt: number | null) => {
  if (!lastFetchedAt) return true;
  return Date.now() - lastFetchedAt > CHANNELS_CACHE_TTL_MS;
};

export default channelsSlice.reducer;
