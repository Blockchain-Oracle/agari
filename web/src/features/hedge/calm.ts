import { isTickerSymbol, TICKERS, type TickerSymbol } from "@agari/core/market";
import type { PreIpoMove } from "@/features/ticker-hub/usePreIpoFacts";

/**
 * "Calm" pre-IPO names (plan §2, D-100): a token almost nobody trades does not move, and Agari resolves a flat Window
 * as Up, so offering its holder a Down bet as cover would be unfair. The judgement is measured, never assumed: the
 * PreStocks feed's own trailing window (`/prestocks/latest` `move`), high to low in basis points, over at least a
 * quarter of an hour of samples. A name that wakes up stops being calm with no code change.
 */
export const CALM_RANGE_BPS = 20;
export const CALM_MIN_WINDOW_SEC = 15 * 60;

export function isCalm(move: PreIpoMove | null | undefined): boolean {
  return !!move && move.windowSec >= CALM_MIN_WINDOW_SEC && move.rangeBps < CALM_RANGE_BPS;
}

/** The names the facts payload shows as calm; empty without facts, so nothing is ever hidden on a failed read. */
export function calmSet(facts: Record<string, { move?: PreIpoMove | null }> | null | undefined): Set<TickerSymbol> {
  const out = new Set<TickerSymbol>();
  if (!facts) return out;
  for (const [symbol, row] of Object.entries(facts)) if (isTickerSymbol(symbol) && isCalm(row.move)) out.add(symbol);
  return out;
}

export const holdsPreIpo = (holdings: readonly { underlying: TickerSymbol }[]): boolean => holdings.some((h) => TICKERS[h.underlying].kind === "preIpo");

/** "2 h" from 90 min up, "35 min" below: the window the movement was measured over, in the reader's units. */
export function windowText(sec: number): string {
  const minutes = Math.round(sec / 60);
  return minutes >= 90 ? `${Math.round(minutes / 60)} h` : `${minutes} min`;
}

/** Basis points as a tenth-of-a-percent text, unsigned ("2.3%"). */
export const bpsPct = (bps: number): string => `${(Math.abs(bps) / 100).toFixed(1)}%`;
