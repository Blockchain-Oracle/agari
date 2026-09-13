"use client";

import { MARKETS_POLL_MS } from "@masayume/core/constants";
import { classifyRangeBand, type RangeBandKind, type RangeRound } from "@masayume/core/range";
import type { Reading } from "@masayume/core/schemas";
import type { Address, IndexedStatus, MarketId } from "@masayume/core/types";
import { marketsProvider, withReading } from "@masayume/markets";
import { listRangesOf } from "@masayume/markets/range";
import { keys, useReadingQuery } from "@masayume/markets/react";

/** A round with the Window it sits on read beside it, so the slip can say what it is and when it can settle. */
export interface RangeRoundView extends RangeRound {
  asset: string | null;
  intervalSec: number | null;
  /** The venue has resolved or voided the Window: the hub's print is there to settle on. */
  settledOnchain: boolean;
  /** A band, or a Moonshot — read off the band's shape, since the contract stores no such flag. */
  kind: RangeBandKind;
}

const SETTLED: ReadonlySet<IndexedStatus> = new Set<IndexedStatus>(["Resolved", "Voided", "Finalized"]);

/** Nested under the adapter's key so one invalidation after a write refreshes both. */
export const rangeRoundsKey = (wallet: string | null) => [...keys.ranges(wallet), "view"] as const;

export async function listRangeRounds(wallet: Address): Promise<Reading<RangeRoundView[]>> {
  return withReading(`range-rounds:${wallet}`, async (inner) => {
    const rounds = inner(await listRangesOf(wallet));
    const ids = [...new Set(rounds.map((round) => round.marketId))];
    const rows = await Promise.all(ids.map(async (id) => [id, inner(await marketsProvider.getMarket(id))] as const));
    const byId = new Map<MarketId, (typeof rows)[number][1]>(rows);
    return rounds.map((round) => {
      const market = byId.get(round.marketId) ?? null;
      return {
        ...round,
        asset: market?.asset ?? null,
        intervalSec: market?.intervalSec ?? null,
        settledOnchain: market ? SETTLED.has(market.status) : false,
        kind: classifyRangeBand(round.openingPrint, round.lowPrint, round.highPrint),
      };
    });
  });
}

export function useRangeRounds(wallet: Address | null): Reading<RangeRoundView[]> | null {
  return useReadingQuery(rangeRoundsKey(wallet), () => listRangeRounds(wallet as Address), { pollMs: MARKETS_POLL_MS, enabled: wallet !== null });
}
