import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface ChannelListItem {
  id: string;
  questionTitle: string;
  counterpartId: string;
  counterpartName: string;
  counterpartImage?: string;
  counterpartIsOnline?: boolean;
  counterpartLastActiveAt?: string;
  status: "ACTIVE" | "CLOSED" | "EXPIRED";
  lastMessagePreview?: string;
  lastMessageAt?: string;
  unreadCount: number;
  timerDeadline: string;
  role: "asker" | "acceptor";
}

interface ChannelsState {
  list: ChannelListItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  loadedForUserId: string | null;
  activeChannelId: string | null;
}

const CHANNELS_CACHE_TTL_MS = 60 * 1000;

const initialState: ChannelsState = {
  list: [],
  isLoading: false,
  isRefreshing: false,
  error: null,
  lastFetchedAt: null,
  loadedForUserId: null,
  activeChannelId: null,
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
      const index = state.list.findIndex((c) => c.id === action.payload.id);
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
        lastMessagePreview?: string;
        lastMessageAt?: string;
        unreadCount?: number;
        unreadCountIncrement?: number;
      }>,
    ) {
      const channel = state.list.find((c) => c.id === action.payload.channelId);
      if (channel) {
        if (action.payload.lastMessagePreview) {
          channel.lastMessagePreview = action.payload.lastMessagePreview;
        }
        if (action.payload.lastMessageAt) {
          channel.lastMessageAt = action.payload.lastMessageAt;
        }
        if (action.payload.unreadCount !== undefined) {
          channel.unreadCount = action.payload.unreadCount;
        } else if (action.payload.unreadCountIncrement) {
          channel.unreadCount += action.payload.unreadCountIncrement;
        }
      }
    },
    markChannelRead(state, action: PayloadAction<string>) {
      const channel = state.list.find((c) => c.id === action.payload);
      if (channel) channel.unreadCount = 0;
    },
    removeChannel(state, action: PayloadAction<string>) {
      state.list = state.list.filter((c) => c.id !== action.payload);
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
    setActiveChannelId(state, action: PayloadAction<string | null>) {
      state.activeChannelId = action.payload;
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
  setActiveChannelId,
  clearChannelsCache,
} = channelsSlice.actions;

export const selectIsChannelsStale = (lastFetchedAt: number | null) => {
  if (!lastFetchedAt) return true;
  return Date.now() - lastFetchedAt > CHANNELS_CACHE_TTL_MS;
};

export default channelsSlice.reducer;
