import type { TickerSymbol } from "@agari/core/market";
import type { EventMarket, Lane, LaneSet, MarketId } from "@agari/core/types";
import { findMarket, useResolveDeepLink } from "@/lib/deep-link";

export interface HeroSelection {
  marketId: MarketId | null;
  market: EventMarket | null;
  nowMs: number;
}

/**
 * web's useMarketsSelection: the address is the source of truth — the Window `?m=` names (a dead one resolves to its
 * successor with a note), else the pinned ticker's soonest Window in the pinned lane, else the lane's soonest, else the
 * first live Window. Selecting goes through the address (`openWindow`), as web's `replaceUrl` does.
 */
export function useHeroSelection(lanes: LaneSet | null, activeLane: Lane | null, ticker: TickerSymbol | null, nowMs: number): HeroSelection {
  const resolved = useResolveDeepLink(lanes, nowMs);
  const pinnedTicker = ticker === null ? undefined : activeLane?.markets.find((m) => m.asset === ticker);
  const fallback = pinnedTicker ?? activeLane?.markets[0] ?? lanes?.lanes[0]?.markets[0] ?? null;
  const market = resolved.market ?? findMarket(lanes, resolved.marketId) ?? fallback;
  return { marketId: market?.marketId ?? null, market, nowMs };
}
