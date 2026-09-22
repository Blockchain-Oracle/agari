/**
 * Pure helpers a basket surface shares (S19, D-124): which of a basket's members a wallet holds, what they are worth
 * together, and which of the basket's Windows is trading. The hub, `/baskets`, the cover picker and the `/dev`
 * fixtures all read these, so they can never disagree about what "you hold 2 of 4" means.
 */
import { phase } from "@agari/core/lifecycle";
import { basketMembersHeld, type Basket, type PreIpoSymbol } from "@agari/core/market";
import type { EventMarket, LaneSet } from "@agari/core/types";
import type { HoldingView } from "@/features/hedge/useHoldings";

/** A PreStocks holding's underlying is the member's own ticker, so the set of underlyings is the set of held members. */
export const heldSymbols = (holdings: readonly HoldingView[]): Set<string> => new Set(holdings.map((h) => h.underlying));

export interface BasketHolding {
  members: PreIpoSymbol[];
  holdings: HoldingView[];
  /** Null when any held member is unpriced: a partial sum would understate what is held. */
  valueUsdE6: bigint | null;
}

/** The members of `basket` this wallet holds, their holdings, and their summed value. */
export function basketHolding(basket: Basket, holdings: readonly HoldingView[]): BasketHolding {
  const members = basketMembersHeld(basket, heldSymbols(holdings));
  const own = holdings.filter((h) => (members as readonly string[]).includes(h.underlying));
  const valueUsdE6 = own.length > 0 && own.every((h) => h.exposureUsdE6 !== null) ? own.reduce((sum, h) => sum + h.exposureUsdE6!, 0n) : null;
  return { members, holdings: own, valueUsdE6 };
}

/** The basket's trading 24/7 Window (the longest-running one when two overlap at a boundary), or null. */
export function tradingBasketWindow(laneSet: LaneSet | null, symbol: string, nowMs: number): EventMarket | null {
  if (!laneSet || nowMs === 0) return null;
  const trading = laneSet.lanes.flatMap((lane) => lane.markets).filter((m) => m.asset === symbol && m.lane === "token" && phase(m, nowMs) === "trading");
  return [...trading].sort((a, b) => b.expirySec - a.expirySec)[0] ?? null;
}
