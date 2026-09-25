import type { TickerSymbol } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import type { EventMarket, Lane, LaneSet, MarketId, Side } from "@agari/core/types";
import { useMarket } from "@agari/markets/react";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { defaultSide, useBetAgainst } from "@/features/markets/bet-against";
import { findMarket, useResolveDeepLink } from "@/lib/deep-link";

export interface HeroSelection {
  marketId: MarketId | null;
  market: EventMarket | null;
  nowMs: number;
}

/**
 * web's useMarketsSelection for the app: the Window a link named (`/markets/<id>`, or the ticket's `?m=` — web's URL),
 * else the pinned ticker's soonest Window in the pinned lane, else the lane's soonest, else the first live Window. A
 * pick replaces it and — as a phone does on web, where selecting opens the ticket drawer — opens the ticket on it, on
 * the side named or the page's mode (DOWN while "Betting against" is on).
 */
export function useHeroSelection(lanes: LaneSet | null, activeLane: Lane | null, ticker: TickerSymbol | null, nowMs: number) {
  const resolved = useResolveDeepLink(lanes, nowMs);
  const betAgainst = useBetAgainst();
  const [picked, setPicked] = useState<MarketId | null>(null);
  const pickedLive = findMarket(lanes, picked);
  const pickedRead = useMarket(picked !== null && pickedLive === null ? picked : null);
  const pickedMarket = pickedLive ?? (pickedRead && isOk(pickedRead) ? pickedRead.value : null);
  const pinnedTicker = ticker === null ? undefined : activeLane?.markets.find((m) => m.asset === ticker);
  const fallback = pinnedTicker ?? activeLane?.markets[0] ?? lanes?.lanes[0]?.markets[0] ?? null;
  const market = pickedMarket ?? resolved.market ?? findMarket(lanes, resolved.marketId) ?? fallback;

  const select = useCallback(
    (marketId: MarketId, side?: Side) => {
      setPicked(marketId);
      const dir = side ?? resolved.side ?? defaultSide(betAgainst);
      router.push({ pathname: "/ticket", params: dir ? { m: marketId, dir } : { m: marketId } });
    },
    [resolved.side, betAgainst],
  );

  const selection: HeroSelection = { marketId: market?.marketId ?? null, market, nowMs };
  return { selection, select };
}
