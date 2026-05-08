import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type ActivityPeriod = "day" | "week" | "month" | "year";

export interface ActivityDataPoint {
  date: string;
  earned?: number;
  penalty?: number;
  net?: number;
  answerRewards?: number;
  bonuses?: number;
  penalties?: number;
  questionsAsked?: number;
  solved?: number;
  pending?: number;
  count?: number;
}

export interface ActivityBreakdownItem {
  _id: string;
  total?: number;
  count: number;
}

export interface ActivitySummary {
  totalEarned?: number;
  totalPenalty?: number;
  netEarning?: number;
  totalActiveDays?: number;
  bestDay?: {
    date: string;
    amount: number;
  };
  totalBonuses?: number;
  totalAnswerRewards?: number;
  totalAsked?: number;
  totalSolved?: number;
}

interface ActivityState {
  period: ActivityPeriod;
  range: number;
  role: "STUDENT" | "TEACHER" | "ADMIN" | null;
  dataPoints: ActivityDataPoint[];
  summary: ActivitySummary | null;
  typeBreakdown: ActivityBreakdownItem[];
  rangeMessage: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  loadedForUserId: string | null;
}

const ACTIVITY_CACHE_TTL_MS = 60 * 1000;

const initialState: ActivityState = {
  period: "month",
  range: 12,
  role: null,
  dataPoints: [],
  summary: null,
  typeBreakdown: [],
  rangeMessage: null,
  isLoading: false,
  isRefreshing: false,
  error: null,
  lastFetchedAt: null,
  loadedForUserId: null,
};

const activitySlice = createSlice({
  name: "activity",
  initialState,
  reducers: {
    setActivityPeriod(state, action: PayloadAction<ActivityPeriod>) {
      state.period = action.payload;
      state.error = null;
    },
    setActivityLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setActivityRefreshing(state, action: PayloadAction<boolean>) {
      state.isRefreshing = action.payload;
    },
    setActivityError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.isLoading = false;
      state.isRefreshing = false;
    },
    setActivityData(
      state,
      action: PayloadAction<{
        userId: string | null;
        period: ActivityPeriod;
        range: number;
        role: ActivityState["role"];
        dataPoints: ActivityDataPoint[];
        summary: ActivitySummary | null;
        typeBreakdown: ActivityBreakdownItem[];
        rangeMessage: string | null;
      }>,
    ) {
      state.loadedForUserId = action.payload.userId;
      state.period = action.payload.period;
      state.range = action.payload.range;
      state.role = action.payload.role;
      state.dataPoints = action.payload.dataPoints;
      state.summary = action.payload.summary;
      state.typeBreakdown = action.payload.typeBreakdown;
      state.rangeMessage = action.payload.rangeMessage;
      state.lastFetchedAt = Date.now();
      state.isLoading = false;
      state.isRefreshing = false;
      state.error = null;
    },
    clearActivityCache(state) {
      state.dataPoints = [];
      state.summary = null;
      state.typeBreakdown = [];
      state.rangeMessage = null;
      state.lastFetchedAt = null;
      state.loadedForUserId = null;
      state.error = null;
      state.isLoading = false;
      state.isRefreshing = false;
    },
  },
});

export const {
  setActivityPeriod,
  setActivityLoading,
  setActivityRefreshing,
  setActivityError,
  setActivityData,
  clearActivityCache,
} = activitySlice.actions;

export const selectIsActivityStale = (lastFetchedAt: number | null) => {
  if (!lastFetchedAt) return true;
  return Date.now() - lastFetchedAt > ACTIVITY_CACHE_TTL_MS;
};

export default activitySlice.reducer;
