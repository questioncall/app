import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { api } from "@/lib/api";
import {
  selectIsConfigStale,
  setConfig,
  setConfigError,
  setConfigLoading,
  type PlatformConfig,
} from "@/store/slices/configSlice";

type AnswerFormat = "TEXT" | "PHOTO" | "VIDEO" | "ANY";

export function usePlatformConfig() {
  const dispatch = useAppDispatch();
  const { data, lastFetchedAt, isLoading, error } = useAppSelector((s) => s.config);

  const refresh = useCallback(async () => {
    dispatch(setConfigLoading(true));
    try {
      const res = await api.get("/platform/config");
      dispatch(setConfig(res.data as PlatformConfig));
    } catch (err: any) {
      dispatch(
        setConfigError(
          err?.response?.data?.error ?? err?.message ?? "Unable to load platform config.",
        ),
      );
    }
  }, [dispatch]);

  useEffect(() => {
    if (!data || selectIsConfigStale(lastFetchedAt)) {
      void refresh();
    }
  }, [data, lastFetchedAt, refresh]);

  const getDurationMinutes = useCallback(
    (format: AnswerFormat) => {
      if (!data) return 15;
      switch (format) {
        case "TEXT":
          return data.textAnswerDurationMinutes;
        case "PHOTO":
          return data.photoAnswerDurationMinutes;
        case "VIDEO":
          return data.videoAnswerDurationMinutes;
        default:
          return data.photoAnswerDurationMinutes;
      }
    },
    [data],
  );

  const getPointsForFormat = useCallback(
    (format: AnswerFormat) => {
      if (!data) return 0;
      switch (format) {
        case "TEXT":
          return data.pointsPerTextAnswer;
        case "PHOTO":
          return data.pointsPerPhotoAnswer;
        case "VIDEO":
          return data.pointsPerVideoAnswer;
        default:
          return data.pointsPerPhotoAnswer;
      }
    },
    [data],
  );

  const getPlanBySlug = useCallback(
    (slug: string) => data?.plans.find((plan) => plan.slug === slug) ?? null,
    [data],
  );

  const getMaxQuestionsForPlan = useCallback(
    (slug: string) => {
      const plan = getPlanBySlug(slug);
      return plan?.maxQuestions ?? data?.maxQuestionsPerPlan?.[slug] ?? 0;
    },
    [data, getPlanBySlug],
  );

  const nprFromPoints = useCallback(
    (points: number) => {
      const rate = data?.pointToNprRate ?? 1;
      return Math.round(points * rate);
    },
    [data],
  );

  return {
    config: data,
    isLoading,
    error,
    isStale: selectIsConfigStale(lastFetchedAt),
    refresh,
    getDurationMinutes,
    getPointsForFormat,
    getPlanBySlug,
    getMaxQuestionsForPlan,
    nprFromPoints,
  };
}

export type UsePlatformConfigReturn = ReturnType<typeof usePlatformConfig>;
