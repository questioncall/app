import { createTransform } from "redux-persist";

/**
 * Limits the channel message cache during persistence:
 * - Max 50 channels in the cache
 * - Max 200 messages per channel
 * - Most recently fetched channels are kept first
 */
export const channelCacheLimiter = createTransform(
  // inbound: state → persisted storage (cap the cache before saving)
  (inboundState: Record<string, unknown>, _key: string) => {
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
  (outboundState: Record<string, unknown>, _key: string) => outboundState,
  // Only apply this transform to the "channel" slice
  { whitelist: ["channel"] },
);
