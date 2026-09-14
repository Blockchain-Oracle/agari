/**
 * The spot-price seam between price-relay (which produces it, lane 3b) and its consumers: the seed maker (3c) in
 * process, and web through `/prices/stream` (venue-ops.md §6.4). Integers only: `priceE8` is price × 10⁸.
 */
import type { TickerSymbol } from "@agari/core/market";

export interface SpotQuote {
  symbol: TickerSymbol;
  priceE8: bigint;
  /** The source's own publish time. */
  publishTimeSec: number;
  source: "pyth" | "redstone";
}

export interface SpotFeed {
  /** The latest quote, or null when none is fresher than `maxAgeSec` (default 30). */
  latest(symbol: TickerSymbol, maxAgeSec?: number): SpotQuote | null;
  /** Every new quote; returns the unsubscribe. */
  subscribe(listener: (quote: SpotQuote) => void): () => void;
}
