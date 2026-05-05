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
}

const initialState: ChannelsState = {
  list: [],
  isLoading: false,
  isRefreshing: false,
  error: null,
};

const channelsSlice = createSlice({
  name: "channels",
  initialState,
  reducers: {
    setChannels(state, action: PayloadAction<ChannelListItem[]>) {
      state.list = action.payload;
      state.isLoading = false;
      state.isRefreshing = false;
    },
    updateChannelLastMessage(
      state,
      action: PayloadAction<{
        channelId: string;
        lastMessage: ChannelListItem["lastMessage"];
        unreadCount?: number;
      }>
    ) {
      const channel = state.list.find(
        (c) => c._id === action.payload.channelId
      );
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
  },
});

export const {
  setChannels,
  updateChannelLastMessage,
  markChannelRead,
  removeChannel,
  setChannelsLoading,
  setChannelsRefreshing,
  setChannelsError,
} = channelsSlice.actions;
export default channelsSlice.reducer;
