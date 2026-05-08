import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface Course {
  _id: string;
  id?: string;
  title: string;
  slug: string;
  description?: string | null;
  subject?: string;
  level?: string;
  pricingModel: "FREE" | "SUBSCRIPTION_INCLUDED" | "PAID";
  price?: number | null;
  status: string;
  instructorName?: string;
  instructorRole?: string;
  thumbnailUrl?: string | null;
  currency?: string;
  isFeatured?: boolean;
  totalDurationMinutes?: number | null;
  enrollmentCount?: number;
  startDate?: string | null;
  expectedEndDate?: string | null;
  overallProgressPercent?: number;
}

interface CoursesState {
  list: Course[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastFetchedAt: number | null;
}

const COURSES_CACHE_TTL_MS = 10 * 60 * 1000;

const initialState: CoursesState = {
  list: [],
  isLoading: false,
  isRefreshing: false,
  error: null,
  lastFetchedAt: null,
};

const coursesSlice = createSlice({
  name: "courses",
  initialState,
  reducers: {
    setCourses(state, action: PayloadAction<Course[]>) {
      state.list = action.payload;
      state.lastFetchedAt = Date.now();
      state.isLoading = false;
      state.isRefreshing = false;
      state.error = null;
    },
    setCoursesLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setCoursesRefreshing(state, action: PayloadAction<boolean>) {
      state.isRefreshing = action.payload;
    },
    setCoursesError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.isLoading = false;
      state.isRefreshing = false;
    },
    clearCoursesCache(state) {
      state.list = [];
      state.lastFetchedAt = null;
      state.error = null;
      state.isLoading = false;
      state.isRefreshing = false;
    },
  },
});

export const {
  setCourses,
  setCoursesLoading,
  setCoursesRefreshing,
  setCoursesError,
  clearCoursesCache,
} = coursesSlice.actions;

export const selectIsCoursesStale = (lastFetchedAt: number | null) => {
  if (!lastFetchedAt) return true;
  return Date.now() - lastFetchedAt > COURSES_CACHE_TTL_MS;
};

export default coursesSlice.reducer;
