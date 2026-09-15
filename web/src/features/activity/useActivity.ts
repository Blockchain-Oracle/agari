"use client";

import { isOk } from "@agari/core/schemas";
import type { Address } from "@agari/core/types";
import { useQuery } from "@tanstack/react-query";
import { useVenue } from "@/features/markets/useVenue";
import type { MoneyUnits } from "./describe";
import { ACTIVITY_POLL_MS, activityKey, followingKey, tickerKey, type ActivityFeed } from "./protocol";

export interface FeedReading {
  feed: ActivityFeed | null;
  /** The last request failed; `feed` still holds the last good answer, if any. */
  failed: boolean;
}

async function readFeed(path: string, signal: AbortSignal): Promise<ActivityFeed> {
  const response = await fetch(path, { signal, cache: "no-store" });
  if (!response.ok) throw new Error(`activity ${response.status}`);
  return (await response.json()) as ActivityFeed;
}

/**
 * Polled every 15 s, and only while the tab is visible (spec §4): TanStack Query skips a background interval, and
 * a tab coming back refetches once. A failed refresh keeps the last rows on screen.
 */
function usePolledFeed(key: readonly unknown[], path: string | null): FeedReading {
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => readFeed(path as string, signal),
    enabled: path !== null,
    refetchInterval: ACTIVITY_POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: ACTIVITY_POLL_MS,
  });
  return { feed: query.data ?? null, failed: query.isError };
}

/** The wallet's inbox. `LifecycleWatcher` and `/activity` share this one cache entry, so a tab polls it once. */
export function useInboxFeed(wallet: Address | null): FeedReading {
  return usePolledFeed(activityKey(wallet), wallet ? `/api/activity?wallet=${encodeURIComponent(wallet)}` : null);
}

export function useFollowingFeed(wallet: Address | null, enabled = true): FeedReading {
  return usePolledFeed(followingKey(wallet), wallet && enabled ? `/api/activity/following?wallet=${encodeURIComponent(wallet)}` : null);
}

export function useTickerFeed(symbol: string | null): FeedReading {
  return usePolledFeed(tickerKey(symbol), symbol ? `/api/activity/ticker/${encodeURIComponent(symbol)}` : null);
}

/** Collateral decimals and symbol from the boot read every money figure in the app already waits on. */
export function useMoneyUnits(): MoneyUnits {
  const { boot, decimals } = useVenue();
  return { decimals, symbol: boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC" };
}
