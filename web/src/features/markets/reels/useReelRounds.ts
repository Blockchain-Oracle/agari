"use client";

import { isEnterable, phase, type MarketPhase } from "@masayume/core/lifecycle";
import type { EventMarket, LaneSet } from "@masayume/core/types";
import { useRef } from "react";

/**
 * Windows in the reel — one per asset and lane, soonest bell first, capped.
 *
 * Yosuku's reel is `fetchMarkets624`: one live round per cadence, three cards, kept while
 * `expiry - now > minMintMs(cadence) * 0.6` and sorted by expiry (`app/reels/page.tsx` L268–273).
 * The venue here lists more than one asset and its lanes hold more than one Window each, so the
 * same bound is taken per asset and lane — the soonest Window still in the reel — and the feed
 * stops at REEL_CAP rather than growing with the venue. It had grown to a hundred cards.
 *
 * Membership derives from `phase()`, since the entry cutoff already lives in core as the no-entry
 * buffer, rather than a second copy of the heuristic. A Window inside the buffer stays on screen
 * and says it is closing; one that has locked is gone.
 */
const IN_REEL: ReadonlySet<MarketPhase> = new Set<MarketPhase>(["pendingOpeningPrint", "trading", "noEntryBuffer"]);
/** Three in the reference; every asset × every lane here, and never a feed of a hundred cards. */
const REEL_CAP = 12;

export function reelPhase(market: EventMarket, nowMs: number): MarketPhase {
  return phase(market, nowMs);
}

/** True once the Window stops taking entries — the card keeps its frame and says so. */
export function isClosing(marketPhase: MarketPhase): boolean {
  return !isEnterable(marketPhase) && IN_REEL.has(marketPhase);
}

function sameIds(a: readonly EventMarket[], b: readonly EventMarket[]): boolean {
  return a.length === b.length && a.every((market, i) => market.marketId === b[i]!.marketId);
}

function soonestPerAssetAndLane(laneSet: LaneSet, nowMs: number): EventMarket[] {
  const out: EventMarket[] = [];
  for (const lane of laneSet.lanes) {
    const seen = new Set<string>();
    for (const market of [...lane.markets].sort((a, b) => a.expirySec - b.expirySec)) {
      if (seen.has(market.asset) || !IN_REEL.has(phase(market, nowMs))) continue;
      seen.add(market.asset);
      out.push(market);
    }
  }
  return out.sort((a, b) => a.expirySec - b.expirySec).slice(0, REEL_CAP);
}

/**
 * The clock ticks every second, so recomputing this list would hand the feed a new array every
 * second and remount every card. The previous array is kept while the membership and order are
 * unchanged — but only for as long as it came from the lane set still in hand, so a refetched
 * Window is never rendered from the copy the last poll returned.
 */
export function useReelRounds(laneSet: LaneSet | null, nowMs: number): EventMarket[] {
  const held = useRef<{ from: LaneSet | null; rounds: EventMarket[] }>({ from: null, rounds: [] });
  const next = laneSet === null || nowMs === 0 ? [] : soonestPerAssetAndLane(laneSet, nowMs);
  if (held.current.from !== laneSet || !sameIds(held.current.rounds, next)) {
    held.current = { from: laneSet, rounds: next };
  }
  return held.current.rounds;
}
