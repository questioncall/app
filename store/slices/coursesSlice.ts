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

// Full course-detail payload (the `/courses/:id` response). Kept loosely typed
// here so the slice doesn't depend on the detail screen; the screen casts it to
// its richer local `CourseDetail` type on read.
export type CourseDetailData = Course & {
  sections?: unknown[];
  [key: string]: unknown;
};

export interface CourseDetailCacheEntry {
  data: CourseDetailData;
  fetchedAt: number;
}

interface CoursesState {
  list: Course[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  // Prefetched full course details, keyed by course id, for instant navigation.
  details: Record<string, CourseDetailCacheEntry>;
}

const COURSES_CACHE_TTL_MS = 10 * 60 * 1000;
const COURSE_DETAIL_CACHE_TTL_MS = 5 * 60 * 1000;

const initialState: CoursesState = {
  list: [],
  isLoading: false,
  isRefreshing: false,
  error: null,
  lastFetchedAt: null,
  details: {},
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
    setCourseDetail(
      state,
      action: PayloadAction<{ id: string; data: CourseDetailData }>,
    ) {
      state.details[action.payload.id] = {
        data: action.payload.data,
        fetchedAt: Date.now(),
      };
    },
    // Keep the cached detail's favourite flag in sync after a local toggle so a
    // re-open within the TTL doesn't replay stale state.
    patchCourseDetailFavourite(
      state,
      action: PayloadAction<{ id: string; isFavourite: boolean }>,
    ) {
      const entry = state.details[action.payload.id];
      if (entry) {
        entry.data.isFavourite = action.payload.isFavourite;
      }
    },
    // Following a teacher affects every cached course by that instructor.
    patchCourseDetailFollow(
      state,
      action: PayloadAction<{
        instructorId: string;
        isFollowing: boolean;
        followerCount: number;
      }>,
    ) {
      for (const id of Object.keys(state.details)) {
        const entry = state.details[id];
        if (String(entry.data.instructorId) === action.payload.instructorId) {
          entry.data.isFollowingInstructor = action.payload.isFollowing;
          entry.data.instructorFollowerCount = action.payload.followerCount;
        }
      }
    },
    clearCoursesCache(state) {
      state.list = [];
      state.lastFetchedAt = null;
      state.error = null;
      state.isLoading = false;
      state.isRefreshing = false;
      state.details = {};
    },
  },
});

export const {
  setCourses,
  setCoursesLoading,
  setCoursesRefreshing,
  setCoursesError,
  setCourseDetail,
  patchCourseDetailFavourite,
  patchCourseDetailFollow,
  clearCoursesCache,
} = coursesSlice.actions;

export const selectIsCoursesStale = (lastFetchedAt: number | null) => {
  if (!lastFetchedAt) return true;
  return Date.now() - lastFetchedAt > COURSES_CACHE_TTL_MS;
};

export const selectIsCourseDetailStale = (fetchedAt: number | null | undefined) => {
  if (!fetchedAt) return true;
  return Date.now() - fetchedAt > COURSE_DETAIL_CACHE_TTL_MS;
};

export default coursesSlice.reducer;
