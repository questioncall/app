import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type UserRole = "STUDENT" | "TEACHER" | "ADMIN";

export interface AppUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  username?: string | null;
  bio?: string | null;
  image?: string;
  skills?: string[];
  interests?: string[];
  points: number;
  pointBalance: number;
  subscriptionStatus: string;
  subscriptionEnd?: string | null;
  planSlug: string;
  questionsAsked: number;
  bonusQuestions: number;
  maxQuestions: number;
  isSuspended: boolean;
  isMonetized: boolean;
  teacherModeVerified: boolean;
  dailyAnswersCount: number;
  dailyTargetsAchieved: number[];
  esewaNumber?: string;
  referralCode?: string;
  seenNotices?: string[];
  seenOnboardingRoles: string[];
  createdAt?: string | null;
  callSettings?: {
    silentIncomingCalls: boolean;
    incomingRingtone: string;
    outgoingRingtone: string;
  };
}

interface UserState {
  data: AppUser | null;
  isLoading: boolean;
  error: string | null;
}

export type { UserState };

const initialState: UserState = {
  data: null,
  isLoading: false,
  error: null,
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AppUser>) {
      state.data = action.payload;
      state.error = null;
    },
    updateUser(state, action: PayloadAction<Partial<AppUser>>) {
      if (state.data) {
        state.data = { ...state.data, ...action.payload };
      }
    },
    clearUser(state) {
      state.data = null;
      state.error = null;
    },
    setUserLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setUserError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.isLoading = false;
    },
  },
});

export const { setUser, updateUser, clearUser, setUserLoading, setUserError } =
  userSlice.actions;
export default userSlice.reducer;
