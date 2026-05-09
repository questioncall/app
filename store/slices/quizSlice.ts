import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type QuizType = "FREE" | "PREMIUM";
export type QuizSessionStatus = "IN_PROGRESS" | "SUBMITTED";
export type QuizSubmitReason = "MANUAL" | "TIME_EXPIRED" | "ANTI_CHEAT";
export type QuizViolationType = "TAB_HIDDEN" | "BACK_NAVIGATION" | "WINDOW_BLUR";

export interface QuizTopic {
  id: string;
  subject: string;
  topic: string;
  level: string;
  field?: string | null;
  questionCount: number;
  isActive: boolean;
}

export interface QuizQuestion {
  id: string;
  questionText: string;
  options: string[];
  explanation?: string | null;
  correctOptionIndex?: number;
  selectedOptionIndex: number | null;
  isCorrect?: boolean;
}

export interface QuizSession {
  id: string;
  quizType: QuizType;
  status: QuizSessionStatus;
  subject: string;
  topic: string;
  level: string;
  startedAt: string;
  timerDeadline: string;
  submittedAt: string | null;
  score: number;
  pointsAwarded: number;
  submitReason: QuizSubmitReason | null;
  violationCount: number;
  warningLimit: number;
  passPercent: number;
  pointReward: number;
  questionCount: number;
  answeredCount: number;
  questions: QuizQuestion[];
}

interface QuizState {
  topics: QuizTopic[];
  topicsLoading: boolean;
  topicsError: string | null;
  session: QuizSession | null;
  sessionLoading: boolean;
  sessionError: string | null;
}

const initialState: QuizState = {
  topics: [],
  topicsLoading: false,
  topicsError: null,
  session: null,
  sessionLoading: false,
  sessionError: null,
};

const quizSlice = createSlice({
  name: "quiz",
  initialState,
  reducers: {
    setTopics(state, action: PayloadAction<QuizTopic[]>) {
      state.topics = action.payload;
      state.topicsLoading = false;
      state.topicsError = null;
    },
    setTopicsLoading(state, action: PayloadAction<boolean>) {
      state.topicsLoading = action.payload;
    },
    setTopicsError(state, action: PayloadAction<string>) {
      state.topicsError = action.payload;
      state.topicsLoading = false;
    },
    setSession(state, action: PayloadAction<QuizSession>) {
      state.session = action.payload;
      state.sessionLoading = false;
      state.sessionError = null;
    },
    setSessionLoading(state, action: PayloadAction<boolean>) {
      state.sessionLoading = action.payload;
    },
    setSessionError(state, action: PayloadAction<string>) {
      state.sessionError = action.payload;
      state.sessionLoading = false;
    },
    selectAnswer(
      state,
      action: PayloadAction<{ questionId: string; optionIndex: number }>,
    ) {
      if (!state.session) return;
      const q = state.session.questions.find((q) => q.id === action.payload.questionId);
      if (q) q.selectedOptionIndex = action.payload.optionIndex;
    },
    incrementViolation(state) {
      if (state.session) state.session.violationCount += 1;
    },
    clearSession(state) {
      state.session = null;
      state.sessionError = null;
    },
    clearQuiz() {
      return initialState;
    },
  },
});

export const {
  setTopics,
  setTopicsLoading,
  setTopicsError,
  setSession,
  setSessionLoading,
  setSessionError,
  selectAnswer,
  incrementViolation,
  clearSession,
  clearQuiz,
} = quizSlice.actions;

export default quizSlice.reducer;
