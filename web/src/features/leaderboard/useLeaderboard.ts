"use client";

import { diagnosis, err, ok, stale, type Reading } from "@masayume/core";
import { useQuery } from "@tanstack/react-query";
import { BOARD_REFRESH_MS, readLeaderboard } from "./leaderboard-client";
import type { BoardData } from "./protocol";

const POLL_MS = 120_000;
export const LEADERBOARD_KEY = ["masayume", "leaderboard"] as const;

/** Keep the last snapshot during refresh failures; an empty board retries without a page reload. */
export function useLeaderboard(): Reading<BoardData> | null {
  const query = useQuery({
    queryKey: LEADERBOARD_KEY,
    queryFn: ({ signal }) => readLeaderboard(signal),
    staleTime: POLL_MS,
    retry: false,
    refetchInterval: (q) => q.state.data ? POLL_MS : 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  if (query.data) {
    const reading = ok(query.data, query.data.meta.computedAtMs);
    return query.isError ? stale(reading, "refresh-failed")
      : Date.now() - reading.asOfMs > BOARD_REFRESH_MS ? stale(reading, "aged") : reading;
  }
  return query.isError ? err(diagnosis("indexer-down", "Leaderboard request failed or timed out")) : null;
}
