/**
 * The token lane's quote outcomes (session-lanes.md §3.1 `quote-unavailable`): the relay's Switchboard pass (lane 6b)
 * reports every quote it tried, halt-watch reads the streaks. In process only, like the halt board: halt-watch stays
 * the board's single writer, and a restart starts every streak at zero.
 *
 * D-099: a streak that has reached the halt threshold is re-tested by a read-only quote every `PROBE_EVERY_SEC`
 * (`xstocksToProbe`), because once the lane is halted the roller opens no Window, so no print ever tries a quote
 * again and the halt could never clear on its own (529 minutes on 2026-09-16).
 */
import { QUOTE_FAILURES_TO_HALT, type XStockSymbol } from "@agari/core/market";

/** How often a halted xStock's quote source is probed while its streak stays at the halt threshold. */
export const PROBE_EVERY_SEC = 300;

interface Streak {
  failures: number;
  lastAttemptSec: number;
}

const streaks = new Map<XStockSymbol, Streak>();
const wallSec = () => Math.floor(Date.now() / 1000);

/** One quote over `xstocks`' feeds: a success resets their streaks, a failure (error, HTTP 5xx, stale slot) adds one. */
export function recordQuoteResult(xstocks: readonly XStockSymbol[], ok: boolean, nowSec = wallSec()): void {
  for (const xstock of xstocks) streaks.set(xstock, { failures: ok ? 0 : (streaks.get(xstock)?.failures ?? 0) + 1, lastAttemptSec: nowSec });
}

/** Consecutive failed quotes for an xStock; 0 before any quote was tried. */
export function quoteFailureStreak(xstock: XStockSymbol): number {
  return streaks.get(xstock)?.failures ?? 0;
}

/** The xStocks whose streak sits at or past the halt threshold and whose last quote attempt is a probe cadence old (D-099). */
export function xstocksToProbe(nowSec = wallSec(), threshold = QUOTE_FAILURES_TO_HALT): XStockSymbol[] {
  return [...streaks].filter(([, s]) => s.failures >= threshold && nowSec - s.lastAttemptSec >= PROBE_EVERY_SEC).map(([xstock]) => xstock);
}

/** Test seam: forget every streak. */
export function resetQuoteStreaks(): void {
  streaks.clear();
}
