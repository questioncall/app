import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface PlatformConfig {
  // Answer settings
  pointsPerTextAnswer: number;
  pointsPerPhotoAnswer: number;
  pointsPerVideoAnswer: number;
  textAnswerDurationMinutes: number;
  photoAnswerDurationMinutes: number;
  videoAnswerDurationMinutes: number;

  // Rating bonuses/penalties
  bonusPointsFor2Star: number;
  bonusPointsFor3Star: number;
  bonusPointsFor4Star: number;
  bonusPointsFor5Star: number;
  penaltyPointsForLowRating: number;
  monthlyHighScoreBonusPoints: number;

  // Quiz settings
  quizQuestionCount: number;
  quizTimeLimitSeconds: number;
  quizRepeatResetDays: number;
  freeQuizPassPercent: number;
  premiumQuizPassPercent: number;
  freeQuizPointReward: number;
  premiumQuizPointReward: number;
  freeQuizDailySessionLimit: number;
  quizViolationWarningLimit: number;

  // Daily target tiers
  dailyTargets: { answers: number; bonus: number }[];

  // Wallet
  pointToNprRate: number;
  minWithdrawalPoints: number;

  // Question limits
  maxQuestionsPerPlan: Record<string, number>;

  // Subscription
  plans: {
    slug: string;
    name: string;
    price: number;
    maxQuestions: number;
    features: string[];
  }[];

  // Anti-cheat
  antiCheatConsecutiveThreshold: number;
  antiCheatSuspensionDays: number;

  // Peer comments
  peerCommentPointThreshold: number;
  peerCommentMinPointReward: number;
  peerCommentMaxPointReward: number;

  // Referral
  referralBonusQuestions: number;
  referrerBonusQuestions: number;

  // Course
  coursePurchaseCommissionPercent: number;
  courseProgressCompletionThreshold: number;

  // Teacher qualification
  qualificationThreshold: number;

  // Payment
  manualPaymentQrCodeUrl?: string;
  adminEsewaNumber?: string;

  // Onboarding
  onboardingVideos?: Record<string, string>;

  // Legal
  termsOfUseUrl?: string;
  privacyPolicyUrl?: string;
}

interface ConfigState {
  data: PlatformConfig | null;
  lastFetchedAt: number | null;
  isLoading: boolean;
  error: string | null;
}

const TTL_MS = 60 * 60 * 1000; // 1 hour

const initialState: ConfigState = {
  data: null,
  lastFetchedAt: null,
  isLoading: false,
  error: null,
};

const configSlice = createSlice({
  name: "config",
  initialState,
  reducers: {
    setConfig(state, action: PayloadAction<PlatformConfig>) {
      state.data = action.payload;
      state.lastFetchedAt = Date.now();
      state.isLoading = false;
      state.error = null;
    },
    setConfigLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setConfigError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearConfig(state) {
      state.data = null;
      state.lastFetchedAt = null;
    },
  },
});

export const { setConfig, setConfigLoading, setConfigError, clearConfig } =
  configSlice.actions;

export const selectIsConfigStale = (lastFetchedAt: number | null) => {
  if (!lastFetchedAt) return true;
  return Date.now() - lastFetchedAt > TTL_MS;
};

export default configSlice.reducer;
