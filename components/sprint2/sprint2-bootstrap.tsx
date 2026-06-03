import { useCallback, useEffect } from "react";
import { AppState } from "react-native";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { api } from "@/lib/api";
import {
  setNotices,
  setNoticesError,
  setNoticesLoading,
} from "@/store/slices/noticesSlice";
import {
  setOnboardingData,
  setOnboardingError,
  setOnboardingLoading,
} from "@/store/slices/onboardingSlice";

export function Sprint2Bootstrap() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const user = useAppSelector((s) => s.user.data);
  const onboardingLoadedForUserId = useAppSelector((s) => s.onboarding.loadedForUserId);
  const noticesLoadedForUserId = useAppSelector((s) => s.notices.loadedForUserId);

  const fetchOnboarding = useCallback(async () => {
    if (!user?._id) return;

    dispatch(setOnboardingLoading(true));
    try {
      const res = await api.get("/onboarding-video");
      dispatch(
        setOnboardingData({
          shouldShow: Boolean(res.data?.shouldShow),
          role: res.data?.role ?? user.role,
          video: res.data?.video ?? null,
          userId: user._id,
        }),
      );
    } catch (err: any) {
      dispatch(
        setOnboardingError(
          err?.response?.data?.error ?? "Unable to load onboarding video.",
        ),
      );
    }
  }, [dispatch, user?._id, user?.role]);

  const fetchNotices = useCallback(
    async (activateModal = true) => {
      if (!user?._id) return;

      dispatch(setNoticesLoading(true));
      try {
        const res = await api.get("/notices");
        dispatch(
          setNotices({
            notices: Array.isArray(res.data) ? res.data : [],
            userId: user._id,
            activateModal,
          }),
        );
      } catch (err: any) {
        dispatch(
          setNoticesError(err?.response?.data?.error ?? "Unable to load notices."),
        );
      }
    },
    [dispatch, user?._id],
  );

  useEffect(() => {
    if (!isAuthenticated || !user?._id) return;

    if (onboardingLoadedForUserId !== user._id) {
      void fetchOnboarding();
    }
    if (noticesLoadedForUserId !== user._id) {
      void fetchNotices(true);
    }
  }, [
    fetchNotices,
    fetchOnboarding,
    isAuthenticated,
    noticesLoadedForUserId,
    onboardingLoadedForUserId,
    user?._id,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !user?._id) return;

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void fetchNotices(true);
      }
    });

    return () => subscription.remove();
  }, [fetchNotices, isAuthenticated, user?._id]);

  return null;
}
