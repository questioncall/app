import { createTransform } from "redux-persist";

/**
 * Excludes transient loading/refreshing states from persistence.
 * Applied to all persisted slices to prevent stuck loading spinners.
 */
export const loadingStateExcluder = createTransform(
  (inboundState: any) => {
    if (typeof inboundState !== "object" || inboundState === null) return inboundState;
    const { isLoading, isRefreshing, ...rest } = inboundState;
    return rest;
  },
  (outboundState: any) => {
    if (typeof outboundState !== "object" || outboundState === null) return outboundState;
    return {
      ...outboundState,
      ...(outboundState.hasOwnProperty("isLoading") && { isLoading: false }),
      ...(outboundState.hasOwnProperty("isRefreshing") && { isRefreshing: false }),
    };
  },
);

/**
 * Limits the channel message cache during persistence:
 * - Max 50 channels in the cache
 * - Max 200 messages per channel
 * - Most recently fetched channels are kept first
 */
export const channelCacheLimiter = createTransform(
  // inbound: state → persisted storage (cap the cache before saving)
  (inboundState: Record<string, unknown>, _key: string | number) => {
    const state = inboundState as {
      cache?: Record<string, { messages?: unknown[]; fetchedAt?: number }>;
    };

    if (!state?.cache) return inboundState;

    const cache = state.cache;
    const entries = Object.entries(cache);

    // Sort by fetchedAt (most recent first) and keep top 50
    const sorted = entries
      .sort(([, a], [, b]) => (b.fetchedAt ?? 0) - (a.fetchedAt ?? 0))
      .slice(0, 50);

    // Limit messages per channel to last 200
    const limitedCache: Record<string, { messages: unknown[]; fetchedAt?: number }> = {};
    for (const [key, entry] of sorted) {
      limitedCache[key] = {
        ...entry,
        messages: Array.isArray(entry.messages) ? entry.messages.slice(-200) : [],
      };
    }

    return { ...state, cache: limitedCache };
  },
  // outbound: persisted → state (no transformation needed on rehydration)
  (outboundState: Record<string, unknown>, _key: string | number) => outboundState,
  // Only apply this transform to the "channel" slice
  { whitelist: ["channel"] },
);

/**
 * Bounds the prefetched course-detail cache during persistence so it can't grow
 * forever in AsyncStorage:
 * - Keeps the 25 most-recently-fetched course details
 * - Older entries are dropped (they re-fetch on demand)
 */
const MAX_PERSISTED_COURSE_DETAILS = 25;

export const courseDetailCacheLimiter = createTransform(
  (inboundState: Record<string, unknown>, _key: string | number) => {
    const state = inboundState as {
      details?: Record<string, { fetchedAt?: number }>;
    };

    if (!state?.details) return inboundState;

    const entries = Object.entries(state.details);
    if (entries.length <= MAX_PERSISTED_COURSE_DETAILS) return inboundState;

    const limited = entries
      .sort(([, a], [, b]) => (b.fetchedAt ?? 0) - (a.fetchedAt ?? 0))
      .slice(0, MAX_PERSISTED_COURSE_DETAILS);

    return { ...state, details: Object.fromEntries(limited) };
  },
  (outboundState: Record<string, unknown>, _key: string | number) => outboundState,
  // Only apply this transform to the "courses" slice
  { whitelist: ["courses"] },
);
