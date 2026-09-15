/**
 * The token lane's quote outcomes (session-lanes.md §3.1 `quote-unavailable`): the relay's Switchboard pass (lane 6b)
 * reports every quote it tried, halt-watch reads the streaks. In process only, like the halt board: halt-watch stays
 * the board's single writer, and a restart starts every streak at zero.
 */
import type { XStockSymbol } from "@agari/core/market";

const streaks = new Map<XStockSymbol, number>();

/** One quote over `xstocks`' feeds: a success resets their streaks, a failure (error, HTTP 5xx, stale slot) adds one. */
export function recordQuoteResult(xstocks: readonly XStockSymbol[], ok: boolean): void {
  for (const xstock of xstocks) streaks.set(xstock, ok ? 0 : (streaks.get(xstock) ?? 0) + 1);
}

/** Consecutive failed quotes for an xStock; 0 before any quote was tried. */
export function quoteFailureStreak(xstock: XStockSymbol): number {
  return streaks.get(xstock) ?? 0;
}
