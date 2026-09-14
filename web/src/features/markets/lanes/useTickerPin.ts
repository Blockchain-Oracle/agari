"use client";

import { isTickerSymbol, TICKER_SYMBOLS, type TickerSymbol } from "@agari/core/market";
import type { EventMarket, Lane } from "@agari/core/types";
import { useCallback } from "react";
import { usePersistedState } from "@/lib/persisted";

const TICKER_KEY = "agari.ticker";
const ALL = "";

const tickerCodec = {
  parse: (raw: string): TickerSymbol | typeof ALL | null => (raw === ALL || isTickerSymbol(raw) ? raw : null),
  serialize: (value: TickerSymbol | typeof ALL) => value,
};

/** The pinned ticker, remembered across visits like the pinned cadence; null shows every ticker in the lane. */
export function useTickerPin(): [TickerSymbol | null, (ticker: TickerSymbol | null) => void] {
  const [pinned, persist] = usePersistedState<TickerSymbol | typeof ALL>(TICKER_KEY, ALL, tickerCodec);
  const pin = useCallback((ticker: TickerSymbol | null) => persist(ticker ?? ALL), [persist]);
  return [pinned === ALL ? null : pinned, pin];
}

/** The tickers a lane lists, in registry order (TICKER_SYMBOLS), so the picker never reshuffles as Windows roll. */
export function laneTickers(lane: Lane | null): TickerSymbol[] {
  const listed = new Set(lane?.markets.map((market) => market.asset));
  return TICKER_SYMBOLS.filter((symbol) => listed.has(symbol));
}

/** One ticker's live Windows in a lane, soonest first (the lane is already sorted by expiry). */
export function tickerMarkets(lane: Lane | null, ticker: TickerSymbol | null): readonly EventMarket[] {
  if (!lane) return [];
  return ticker === null ? lane.markets : lane.markets.filter((market) => market.asset === ticker);
}
