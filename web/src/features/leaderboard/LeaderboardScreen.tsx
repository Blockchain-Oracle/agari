"use client";

import { isOk } from "@masayume/core/schemas";
import { useLanes } from "@masayume/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { useWalletSession } from "@/lib/wallet-session";
import { LeaderboardBoard } from "./LeaderboardBoard";
import { LEADERBOARD_KEY, useLeaderboard } from "./useLeaderboard";

/**
 * `/leaderboard` — ported from `reference/yosuku/app/leaderboard/page.tsx`.
 *
 * The rankings come from `/api/leaderboard`; the "next close" seal reads the live lanes the
 * rest of the app already holds, so the countdown here is the same one the markets page shows.
 */
export function LeaderboardScreen() {
  const { address } = useWalletSession();
  const { venueId } = useVenue();
  const lanes = useLanes(venueId);
  const nowMs = useChainNowMs();
  const reading = useLeaderboard();
  const queryClient = useQueryClient();
  const retry = useCallback(() => void queryClient.invalidateQueries({ queryKey: LEADERBOARD_KEY }), [queryClient]);

  const nextExpirySec =
    lanes && isOk(lanes)
      ? lanes.value.lanes
          .flatMap((lane) => lane.markets.map((market) => market.expirySec))
          .filter((expiry) => expiry * 1000 > nowMs)
          .reduce<number | null>((min, expiry) => (min === null || expiry < min ? expiry : min), null)
      : null;

  return <LeaderboardBoard reading={reading} address={address} nextExpirySec={nextExpirySec} nowMs={nowMs} retry={retry} />;
}
