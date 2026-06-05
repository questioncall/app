import { useEffect, useState } from "react";
import { publicApi } from "@/lib/api";

export type FilterOptions = {
  subjects: string[];
  streams: string[];
  levels: string[];
};

// Hard-coded fallback list — matches the web post-question modal so users
// can still pick chips offline or while the cache is empty. Source:
// web/components/shared/post-question-modal.tsx
const FALLBACK: FilterOptions = {
  subjects: [
    "IT",
    "Biology",
    "Chemistry",
    "Physics",
    "Mathematics",
    "English",
    "Accountancy",
  ],
  streams: ["Science", "Management", "Law", "Humanities", "Education", "Others"],
  levels: ["Below 10", "11/12", "Bachelor"],
};

const TTL_MS = 60 * 60 * 1000; // 1 hour, mirrors the server's `revalidate = 3600`
let cache: { options: FilterOptions; fetchedAt: number } | null = null;
let inflight: Promise<FilterOptions> | null = null;

async function fetchOptions(): Promise<FilterOptions> {
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await publicApi.get("/filters/options");
      const data = res.data ?? {};
      const next: FilterOptions = {
        subjects:
          Array.isArray(data.subjects) && data.subjects.length > 0
            ? data.subjects
            : FALLBACK.subjects,
        streams:
          Array.isArray(data.streams) && data.streams.length > 0
            ? data.streams
            : FALLBACK.streams,
        levels:
          Array.isArray(data.levels) && data.levels.length > 0
            ? data.levels
            : FALLBACK.levels,
      };
      cache = { options: next, fetchedAt: Date.now() };
      return next;
    } catch {
      cache = { options: FALLBACK, fetchedAt: Date.now() };
      return FALLBACK;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function useFilterOptions() {
  const [options, setOptions] = useState<FilterOptions>(cache?.options ?? FALLBACK);
  const [isLoading, setIsLoading] = useState(!cache);

  useEffect(() => {
    const isFresh = cache && Date.now() - cache.fetchedAt < TTL_MS;
    if (isFresh) {
      setOptions(cache!.options);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    void fetchOptions().then((next) => {
      if (!active) return;
      setOptions(next);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { options, isLoading };
}
