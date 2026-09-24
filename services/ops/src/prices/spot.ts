/**
 * The spot-price seam between price-relay (which produces it, lane 3b) and its consumers: the seed maker (3c) in
 * process, and web through `/prices/stream` (venue-ops.md §6.4). Integers only: `priceE8` is price × 10⁸.
 */
import type { TickerSymbol, XStockSymbol } from "@agari/core/market";

export interface SpotQuote {
  symbol: TickerSymbol | XStockSymbol;
  priceE8: bigint;
  /** The source's own publish time. */
  publishTimeSec: number;
  /** `"prestocks"`: the catalogue's `tokenPrice` for a pre-IPO name (plan Step 1); display and quoting only. */
  /** `"switchboard"`: a token-lane xStock's Surge value, read unsigned for display beside its 24/7 Windows. */
  source: "pyth" | "redstone" | "jupiter" | "prestocks" | "switchboard";
}

export interface SpotFeed {
  /** The latest quote, or null when none is fresher than `maxAgeSec` (default 30). An xStock symbol reads the token lane's spot (S6). */
  latest(symbol: TickerSymbol | XStockSymbol, maxAgeSec?: number): SpotQuote | null;
  /** Every new quote; returns the unsubscribe. */
  subscribe(listener: (quote: SpotQuote) => void): () => void;
}
