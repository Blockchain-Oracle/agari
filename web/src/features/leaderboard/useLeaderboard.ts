"use client";

import { diagnosis, err, ok, stale, type Reading } from "@agari/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BOARD_REFRESH_MS, readLeaderboard, type BoardQuery } from "./leaderboard-client";
import type { BoardData } from "./protocol";

const POLL_MS = 120_000;
export const LEADERBOARD_KEY = ["agari", "leaderboard"] as const;

/**
 * Keep the last snapshot during refresh failures; an empty board retries without a page reload. A tab switch keeps
 * the board on screen until the new slice arrives (the route answers it from the same cached scan).
 */
export function useLeaderboard(board: BoardQuery): Reading<BoardData> | null {
  const query = useQuery({
    queryKey: [...LEADERBOARD_KEY, board.period, board.ticker],
    queryFn: ({ signal }) => readLeaderboard(signal, board),
    staleTime: POLL_MS,
    retry: false,
    placeholderData: keepPreviousData,
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
