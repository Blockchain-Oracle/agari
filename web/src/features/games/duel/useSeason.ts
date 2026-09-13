"use client";

import type { PrizeTier } from "@masayume/core/games";
import { useEffect, useState } from "react";

/** The wire from `/api/games/season`, with the escrow's money as bigint. */
export interface SeasonView {
  id: string;
  name: string;
  endsAt: string;
  prizeSplit: readonly PrizeTier[];
  minStakedDuels: number;
  eligibilityNote: string;
  prizePool: { totalUnits: number; currency: string };
  escrow: {
    address: string;
    balanceBase: bigint;
    depositedBase: bigint;
    distributed: boolean;
    decimals: number;
    symbol: string;
  } | null;
}

interface Wire {
  season: (Omit<SeasonView, "escrow"> & { prizeSplit: PrizeTier[] }) | null;
  escrow: { address: string; balanceBase: string; depositedBase: string; distributed: boolean; decimals: number; symbol: string } | null;
}

/**
 * The season, once: `undefined` until the route answers, `null` when there is none — Flicky's
 * `fetchSeason`, with the escrow read beside the config.
 */
export function useSeason(): SeasonView | null | undefined {
  const [view, setView] = useState<SeasonView | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/games/season")
      .then((r) => r.json() as Promise<Wire>)
      .then((wire) => {
        if (cancelled) return;
        if (!wire.season) return setView(null);
        setView({
          ...wire.season,
          escrow: wire.escrow ? { ...wire.escrow, balanceBase: BigInt(wire.escrow.balanceBase), depositedBase: BigInt(wire.escrow.depositedBase) } : null,
        });
      })
      .catch(() => {
        if (!cancelled) setView(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return view;
}
