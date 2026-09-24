"use client";

import { isOk } from "@agari/core/schemas";
import { useLanes } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { useTraction } from "@/features/stats";
import { useWalletSession } from "@/lib/wallet-session";
import type { BoardQuery } from "./leaderboard-client";
import { LeaderboardBoard } from "./LeaderboardBoard";
import { LEADERBOARD_KEY, useLeaderboard } from "./useLeaderboard";

/**
 * `/leaderboard` — ported from `reference/yosuku/app/leaderboard/page.tsx`.
 *
 * The rankings come from `/api/leaderboard` for the chosen period and ticker ("This session" first); the "next close"
 * seal reads the live lanes the rest of the app already holds, so the countdown here is the same one the markets
 * page shows. Live activity is Masayume's `/stats` feed, read through the same `/api/traction` poll.
 */
export function LeaderboardScreen() {
  const { address } = useWalletSession();
  const { venueId } = useVenue();
  const lanes = useLanes(venueId);
  const nowMs = useChainNowMs();
  const [board, setBoard] = useState<BoardQuery>({ period: "session", ticker: null });
  const reading = useLeaderboard(board);
  const activity = useTraction();
  const queryClient = useQueryClient();
  const retry = useCallback(() => void queryClient.invalidateQueries({ queryKey: LEADERBOARD_KEY }), [queryClient]);

  const nextExpirySec =
    lanes && isOk(lanes)
      ? lanes.value.lanes
          .flatMap((lane) => lane.markets.map((market) => market.expirySec))
          .filter((expiry) => expiry * 1000 > nowMs)
          .reduce<number | null>((min, expiry) => (min === null || expiry < min ? expiry : min), null)
      : null;

  return <LeaderboardBoard reading={reading} address={address} nextExpirySec={nextExpirySec} nowMs={nowMs} board={board} onBoard={setBoard} activity={activity} retry={retry} />;
}
