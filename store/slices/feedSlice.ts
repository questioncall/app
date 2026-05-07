import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface FeedQuestion {
  _id: string;
  title: string;
  body?: string;
  images?: string[];
  answerFormat: "TEXT" | "PHOTO" | "VIDEO" | "ANY";
  answerVisibility: "PUBLIC" | "PRIVATE";
  status: "OPEN" | "ACCEPTED" | "SOLVED";
  resetCount: number;
  subject?: string;
  stream?: string;
  level?: string;
  askerId: string;
  askerName?: string;
  askerImage?: string;
  createdAt: string;
  acceptedById?: string;
  acceptedAt?: string;
}

interface FeedState {
  questions: FeedQuestion[];
  myQuestions: FeedQuestion[];
  isLoading: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  page: number;
  error: string | null;
}

const initialState: FeedState = {
  questions: [],
  myQuestions: [],
  isLoading: false,
  isRefreshing: false,
  hasMore: true,
  page: 1,
  error: null,
};

const feedSlice = createSlice({
  name: "feed",
  initialState,
  reducers: {
    setQuestions(state, action: PayloadAction<FeedQuestion[]>) {
      state.questions = action.payload;
      state.isLoading = false;
      state.isRefreshing = false;
    },
    appendQuestions(state, action: PayloadAction<FeedQuestion[]>) {
      state.questions = [...state.questions, ...action.payload];
      state.isLoading = false;
    },
    prependQuestion(state, action: PayloadAction<FeedQuestion>) {
      state.questions = [action.payload, ...state.questions];
    },
    removeQuestion(state, action: PayloadAction<string>) {
      state.questions = state.questions.filter((q) => q._id !== action.payload);
      state.myQuestions = state.myQuestions.filter(
        (q) => q._id !== action.payload
      );
    },
    updateQuestion(
      state,
      action: PayloadAction<{ id: string; data: Partial<FeedQuestion> }>
    ) {
      const idx = state.questions.findIndex(
        (q) => q._id === action.payload.id
      );
      if (idx !== -1) {
        state.questions[idx] = {
          ...state.questions[idx],
          ...action.payload.data,
        };
      }
    },
    setMyQuestions(state, action: PayloadAction<FeedQuestion[]>) {
      state.myQuestions = action.payload;
    },
    addMyQuestion(state, action: PayloadAction<FeedQuestion>) {
      state.myQuestions = [action.payload, ...state.myQuestions];
    },
    setFeedLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setFeedRefreshing(state, action: PayloadAction<boolean>) {
      state.isRefreshing = action.payload;
    },
    setHasMore(state, action: PayloadAction<boolean>) {
      state.hasMore = action.payload;
    },
    setPage(state, action: PayloadAction<number>) {
      state.page = action.payload;
    },
    setFeedError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearFeedError(state) {
      state.error = null;
    },
  },
});

export const {
  setQuestions,
  appendQuestions,
  prependQuestion,
  removeQuestion,
  updateQuestion,
  setMyQuestions,
  addMyQuestion,
  setFeedLoading,
  setFeedRefreshing,
  setHasMore,
  setPage,
  setFeedError,
  clearFeedError,
} = feedSlice.actions;
export default feedSlice.reducer;
