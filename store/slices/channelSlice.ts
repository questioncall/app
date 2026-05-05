import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface ChatMessage {
  _id: string;
  channelId: string;
  senderId: string;
  senderName?: string;
  senderImage?: string;
  content: string;
  attachments?: { url: string; type: string; name?: string }[];
  isAnswer?: boolean;
  isSystem?: boolean;
  createdAt: string;
  // Local-only state
  isSending?: boolean;
  sendFailed?: boolean;
  localId?: string;
}

interface ChannelState {
  activeChannelId: string | null;
  messages: ChatMessage[];
  pendingMessages: ChatMessage[];
  isLoading: boolean;
  hasMore: boolean;
  page: number;
  error: string | null;
}

const initialState: ChannelState = {
  activeChannelId: null,
  messages: [],
  pendingMessages: [],
  isLoading: false,
  hasMore: true,
  page: 1,
  error: null,
};

const channelSlice = createSlice({
  name: "channel",
  initialState,
  reducers: {
    setActiveChannel(state, action: PayloadAction<string>) {
      state.activeChannelId = action.payload;
      state.messages = [];
      state.page = 1;
      state.hasMore = true;
    },
    setMessages(state, action: PayloadAction<ChatMessage[]>) {
      state.messages = action.payload;
      state.isLoading = false;
    },
    prependMessages(state, action: PayloadAction<ChatMessage[]>) {
      state.messages = [...action.payload, ...state.messages];
    },
    appendMessage(state, action: PayloadAction<ChatMessage>) {
      state.messages = [...state.messages, action.payload];
    },
    updateMessage(
      state,
      action: PayloadAction<{ localId: string; data: Partial<ChatMessage> }>
    ) {
      const idx = state.messages.findIndex(
        (m) => m.localId === action.payload.localId || m._id === action.payload.localId
      );
      if (idx !== -1) {
        state.messages[idx] = { ...state.messages[idx], ...action.payload.data };
      }
    },
    removeMessage(state, action: PayloadAction<string>) {
      state.messages = state.messages.filter((m) => m._id !== action.payload);
    },
    addPendingMessage(state, action: PayloadAction<ChatMessage>) {
      state.pendingMessages = [...state.pendingMessages, action.payload];
      state.messages = [...state.messages, action.payload];
    },
    resolvePendingMessage(
      state,
      action: PayloadAction<{ localId: string; message: ChatMessage }>
    ) {
      state.pendingMessages = state.pendingMessages.filter(
        (m) => m.localId !== action.payload.localId
      );
      const idx = state.messages.findIndex(
        (m) => m.localId === action.payload.localId
      );
      if (idx !== -1) {
        state.messages[idx] = action.payload.message;
      }
    },
    setChannelLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setChannelHasMore(state, action: PayloadAction<boolean>) {
      state.hasMore = action.payload;
    },
    setChannelPage(state, action: PayloadAction<number>) {
      state.page = action.payload;
    },
    clearChannel(state) {
      state.activeChannelId = null;
      state.messages = [];
      state.pendingMessages = [];
      state.page = 1;
      state.hasMore = true;
    },
  },
});

export const {
  setActiveChannel,
  setMessages,
  prependMessages,
  appendMessage,
  updateMessage,
  removeMessage,
  addPendingMessage,
  resolvePendingMessage,
  setChannelLoading,
  setChannelHasMore,
  setChannelPage,
  clearChannel,
} = channelSlice.actions;
export default channelSlice.reducer;
