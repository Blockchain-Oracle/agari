"use client";

import { isStalledOpening, phase } from "@agari/core/lifecycle";
import { assetTicker, ET_WEEKDAY_SHORT, etDateOf, formatEtClock, weekdayOfDate, type TickerSymbol } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import type { EventMarket } from "@agari/core/types";
import { useLanes } from "@agari/markets/react";
import { useMemo } from "react";
import { useVenue } from "../markets/useVenue";

/** What a short can be opened on: a listed stock (market hours), or a 24/7 PreStocks name or basket. */
export type ShortKind = "stock" | "preIpo" | "basket";

export interface ShortStock {
  asset: TickerSymbol;
  kind: ShortKind;
  /** Every Window a short may still enter, trading ones first, then the ones that open later, soonest first. */
  windows: EventMarket[];
  /** How many of those trade right now; zero means the asset only has Windows that open later. */
  liveCount: number;
}

export interface ShortWindows {
  stocks: ShortStock[];
  loading: boolean;
}

/** A Window a short can open on now: the reserve's `owner_open` requires `is_trading` (`open.rs:81`). */
export const isLiveWindow = (market: EventMarket, nowMs: number): boolean => nowMs > 0 && phase(market, nowMs) === "trading";

/** A Window that has not started yet but will: shown so a closed market still names what opens and when. */
const isLaterWindow = (market: EventMarket, nowMs: number): boolean => {
  const p = phase(market, nowMs);
  return p === "upcoming" || (p === "pendingOpeningPrint" && !isStalledOpening(market, nowMs));
};

export function kindOf(asset: string): ShortKind {
  const kind = assetTicker(asset)?.ticker.kind;
  return kind === "basket" ? "basket" : kind === "preIpo" || kind === "valuation" ? "preIpo" : "stock";
}

/** "Wed 09:30 ET": always with the weekday, so an open tomorrow never reads as today. */
export function opensAt(sec: number): string {
  return `${ET_WEEKDAY_SHORT[weekdayOfDate(etDateOf(sec))]} ${formatEtClock(sec)} ET`;
}

/**
 * The stocks a short can be opened on, one entry per asset (S23): the Windows trading now and the ones listed to open
 * later, so a closed market still shows every stock with the time its Windows open instead of an empty or 24/7-only
 * picker. The grid reads no books; only the chosen asset's live Windows subscribe to one.
 */
export function useShortWindows(nowMs: number): ShortWindows {
  const { venueId } = useVenue();
  const reading = useLanes(venueId);
  return useMemo(() => {
    const laneSet = reading && isOk(reading) ? reading.value : null;
    const byAsset = new Map<TickerSymbol, EventMarket[]>();
    for (const market of (laneSet?.lanes ?? []).flatMap((lane) => lane.markets)) {
      if (!isLiveWindow(market, nowMs) && !isLaterWindow(market, nowMs)) continue;
      const held = byAsset.get(market.asset);
      if (held) held.push(market);
      else byAsset.set(market.asset, [market]);
    }
    const rank = (m: EventMarket) => (isLiveWindow(m, nowMs) ? 0 : 1);
    const stocks = [...byAsset.entries()].map(([asset, windows]): ShortStock => {
      const sorted = [...windows].sort((a, b) => rank(a) - rank(b) || a.tradingStartSec - b.tradingStartSec || a.expirySec - b.expirySec);
      return { asset, kind: kindOf(asset), windows: sorted, liveCount: sorted.filter((m) => isLiveWindow(m, nowMs)).length };
    });
    const kindRank: Record<ShortKind, number> = { stock: 0, preIpo: 1, basket: 2 };
    stocks.sort((a, b) => Number(b.liveCount > 0) - Number(a.liveCount > 0) || kindRank[a.kind] - kindRank[b.kind] || a.asset.localeCompare(b.asset));
    return { stocks, loading: reading === null };
  }, [reading, nowMs]);
}
