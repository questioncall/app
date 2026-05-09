import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface WithdrawalHistoryItem {
  _id: string;
  teacherId: string;
  pointsRequested: number;
  nprEquivalent: number;
  esewaNumber: string;
  status: "PENDING" | "COMPLETED" | "REJECTED";
  pointsReserved: boolean;
  transactionId: string | null;
  amountSent: number | null;
  processedAt: string | null;
  processedBy: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EarningHistoryItem {
  id: string;
  type: string;
  title: string;
  description: string | null;
  pointsDelta: number;
  nprAmount: number | null;
  occurredAt: string;
}

export interface QuestionPayoutItem {
  id: string;
  type: string;
  questionTitle: string | null;
  rating: number | null;
  ratingPoints: number;
  bonusPoints: number;
  commissionPercent: number;
  commissionPoints: number;
  penaltyPoints: number;
  finalPoints: number;
  occurredAt: string;
}

export interface WalletData {
  role: "STUDENT" | "TEACHER";
  userName: string;
  pointBalance: number;
  nprEquivalent: number;
  totalAnswered: number;
  isMonetized: boolean;
  overallScore: string;
  pointToNprRate: number;
  minWithdrawalPoints: number;
  qualificationThreshold: number;
  subscriptionStatus: string | null;
  subscriptionEnd: string | null;
  questionsAsked: number;
  questionsRemaining: number | null;
  maxQuestions: number;
  baseMaxQuestions: number;
  bonusQuestions: number;
  referralCode: string | null;
  withdrawalHistory: WithdrawalHistoryItem[];
  withdrawalTotal: number;
  savedEsewaNumber: string | null;
  totalPointsEarned: number;
  totalPointsWithdrawn: number;
  pendingWithdrawal: number;
  totalPenaltyPoints: number;
  creditablePoints: number;
  earningHistory: EarningHistoryItem[];
  earningTotal: number;
  questionPayoutHistory: QuestionPayoutItem[];
  questionPayoutTotal: number;
}

interface WalletState {
  data: WalletData | null;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  isWithdrawing: boolean;
  withdrawError: string | null;
}

const initialState: WalletState = {
  data: null,
  isLoading: false,
  error: null,
  lastFetchedAt: null,
  isWithdrawing: false,
  withdrawError: null,
};

const STALE_MS = 30_000;

const walletSlice = createSlice({
  name: "wallet",
  initialState,
  reducers: {
    setWalletData(state, action: PayloadAction<WalletData>) {
      state.data = action.payload;
      state.lastFetchedAt = Date.now();
      state.isLoading = false;
      state.error = null;
    },
    setWalletLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setWalletError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.isLoading = false;
    },
    setWithdrawing(state, action: PayloadAction<boolean>) {
      state.isWithdrawing = action.payload;
      if (action.payload) state.withdrawError = null;
    },
    setWithdrawError(state, action: PayloadAction<string>) {
      state.withdrawError = action.payload;
      state.isWithdrawing = false;
    },
    clearWithdrawError(state) {
      state.withdrawError = null;
    },
    clearWallet(state) {
      state.data = null;
      state.lastFetchedAt = null;
      state.error = null;
    },
  },
});

export const {
  setWalletData,
  setWalletLoading,
  setWalletError,
  setWithdrawing,
  setWithdrawError,
  clearWithdrawError,
  clearWallet,
} = walletSlice.actions;

export const selectIsWalletStale = (lastFetchedAt: number | null) => {
  if (!lastFetchedAt) return true;
  return Date.now() - lastFetchedAt > STALE_MS;
};

export default walletSlice.reducer;
