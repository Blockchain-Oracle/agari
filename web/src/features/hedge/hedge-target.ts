/**
 * Which holding the card speaks for and which Window it hedges into (session-lanes.md §4). Pure over the lane set, so
 * the live card and the `/dev/hedge` fixtures pick the same way.
 */
import { phase } from "@agari/core/lifecycle";
import type { TickerSymbol } from "@agari/core/market";
import type { EventMarket, LaneSet } from "@agari/core/types";
import { pickBasketHedges } from "./basket-cover";
import { tokenHorizon, type HedgeHorizon } from "./hedge-horizon";
import type { HoldingView } from "./useHoldings";

export type { HedgeHorizon } from "./hedge-horizon";

export interface HedgeTarget {
  market: EventMarket;
  /** `gap` while a Gap Window trades ("Hedge the Monday Gap"); `down` on a Regular or token Window ("Hedge with Down"). */
  kind: "gap" | "down";
  horizon: HedgeHorizon;
}

export interface HedgePick {
  underlying: TickerSymbol;
  /** Every verified token of that underlying the wallet holds, largest first. */
  holdings: HoldingView[];
  sharesE8: bigint;
  /** Null when any of them has no fresh spot: a partial sum would understate the exposure. */
  exposureUsdE6: bigint | null;
  target: HedgeTarget;
}

const latestExpiry = (markets: EventMarket[]): EventMarket | undefined => [...markets].sort((a, b) => b.expirySec - a.expirySec)[0];

/** A trading Gap first, then the longest-running Regular Window in session, then the longest token Window. */
export function hedgeTarget(laneSet: LaneSet | null, underlying: TickerSymbol, nowMs: number): HedgeTarget | null {
  if (!laneSet || nowMs === 0) return null;
  const trading = laneSet.lanes.flatMap((lane) => lane.markets).filter((m) => m.asset === underlying && phase(m, nowMs) === "trading");
  const gap = trading.find((m) => m.lane === "gap");
  if (gap) return { market: gap, kind: "gap", horizon: "weekend" };
  const regular = latestExpiry(trading.filter((m) => m.lane === "regular"));
  if (regular) return { market: regular, kind: "down", horizon: "session" };
  const token = latestExpiry(trading.filter((m) => m.lane === "token"));
  return token ? { market: token, kind: "down", horizon: tokenHorizon(Math.floor(nowMs / 1000)) } : null;
}

/**
 * Every underlying with a Window to cover into, most exposure first (the Reels card rotates through them); then the
 * baskets two or more held members could be covered through (S19 A6), sorted in with them.
 */
const NO_SKIP: ReadonlySet<TickerSymbol> = new Set();

export function pickAllHedges(holdings: readonly HoldingView[], laneSet: LaneSet | null, nowMs: number, skip: ReadonlySet<TickerSymbol> = NO_SKIP): HedgePick[] {
  const byUnderlying = new Map<TickerSymbol, HoldingView[]>();
  for (const holding of holdings) byUnderlying.set(holding.underlying, [...(byUnderlying.get(holding.underlying) ?? []), holding]);
  const picks: HedgePick[] = [];
  for (const [underlying, group] of byUnderlying) {
    // A calm name (plan §2) is never offered a cover bet: a flat Window resolves Up, so Down would be unfair.
    if (skip.has(underlying)) continue;
    const target = hedgeTarget(laneSet, underlying, nowMs);
    if (!target) continue;
    const exposureUsdE6 = group.some((h) => h.exposureUsdE6 === null) ? null : group.reduce((sum, h) => sum + (h.exposureUsdE6 ?? 0n), 0n);
    const pick: HedgePick = { underlying, holdings: [...group].sort((a, b) => (b.sharesE8 > a.sharesE8 ? 1 : b.sharesE8 < a.sharesE8 ? -1 : 0)), sharesE8: group.reduce((sum, h) => sum + h.sharesE8, 0n), exposureUsdE6, target };
    picks.push(pick);
  }
  picks.push(...pickBasketHedges(holdings, laneSet, nowMs, skip));
  return picks.sort((a, b) => ((b.exposureUsdE6 ?? 0n) > (a.exposureUsdE6 ?? 0n) ? 1 : (b.exposureUsdE6 ?? 0n) < (a.exposureUsdE6 ?? 0n) ? -1 : 0));
}

/** The underlying with the most exposure that has a Window to hedge into; null hides the card. */
export const pickHedge = (holdings: readonly HoldingView[], laneSet: LaneSet | null, nowMs: number, skip: ReadonlySet<TickerSymbol> = NO_SKIP): HedgePick | null =>
  pickAllHedges(holdings, laneSet, nowMs, skip)[0] ?? null;
