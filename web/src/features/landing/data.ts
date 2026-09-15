import { formatCadence } from "@agari/core/copy";
import { parseLaneKey, TICKER_SYMBOLS, type TickerSymbol, type TradingSession } from "@agari/core/market";
import type { LaneBasis } from "@agari/core/types";
import { firstWindowStartSec } from "../markets/lanes/next-window";
import type { MarketSession } from "../markets/session";

/**
 * The landing's data, pure over the one `/session` value every always-on surface already reads (D-086): no new path,
 * no new poll. The islands call these with the shared session and the shared 30 s clock.
 */

/** The hero dial's asset: the first launch ticker, as the closed `/markets` hero defaults to. */
export const FEATURED_TICKER: TickerSymbol = "TSLA";
export const FEATURED_TICKERS: readonly TickerSymbol[] = [FEATURED_TICKER];

/** Longer than any weekday overnight (17.5 h) and shorter than any weekend (65.5 h): the break a Gap Window spans. */
const WEEKEND_BREAK_SEC = 36 * 3_600;

export interface CadenceStart {
  cadence: string;
  /** The lane's first Window of the next session; null when the calendar does not name it. */
  startSec: number | null;
}

export interface WeekendSpan {
  closeSec: number;
  openSec: number;
}

export interface LaneBoard {
  /** Tickers ops configures per basis, registry order; an empty list means the lane is not listed. */
  tickers: Record<LaneBasis, TickerSymbol[]>;
  /** Regular cadences ops configures, shortest first, each with its first Window of the next session. */
  regular: CadenceStart[];
  /** Token cadences ops configures, shortest first ("5m"). */
  tokenCadences: string[];
  /** The next Friday-close → Monday-open break the calendar names, or null. */
  weekend: WeekendSpan | null;
}

/** The first break of at least a weekend that has not ended yet: the span the next (or current) Gap Window covers. */
export function nextWeekend(sessions: readonly TradingSession[], nowSec: number): WeekendSpan | null {
  const sorted = [...sessions].sort((a, b) => a.openSec - b.openSec);
  for (let i = 0; i + 1 < sorted.length; i += 1) {
    const [a, b] = [sorted[i], sorted[i + 1]];
    if (a && b && b.openSec > nowSec && b.openSec - a.closeSec >= WEEKEND_BREAK_SEC) return { closeSec: a.closeSec, openSec: b.openSec };
  }
  return null;
}

/** Every lane `/session` configures, grouped for the three lane cards. */
export function laneBoard(session: MarketSession, nowSec: number): LaneBoard {
  const tickers: Record<LaneBasis, TickerSymbol[]> = { regular: [], gap: [], token: [] };
  const regularSec = new Set<number>();
  const tokenSec = new Set<number>();
  for (const key of Object.keys(session.lanes)) {
    const parts = parseLaneKey(key);
    if (!parts) continue;
    if (!tickers[parts.basis].includes(parts.symbol)) tickers[parts.basis].push(parts.symbol);
    if (parts.basis === "regular") regularSec.add(parts.cadenceSec);
    if (parts.basis === "token") tokenSec.add(parts.cadenceSec);
  }
  const order = (list: TickerSymbol[]) => list.sort((x, y) => TICKER_SYMBOLS.indexOf(x) - TICKER_SYMBOLS.indexOf(y));
  const ascending = (set: Set<number>) => [...set].sort((x, y) => x - y);
  return {
    tickers: { regular: order(tickers.regular), gap: order(tickers.gap), token: order(tickers.token) },
    regular: ascending(regularSec).map((sec) => ({ cadence: formatCadence(sec), startSec: firstWindowStartSec(session, sec) })),
    tokenCadences: ascending(tokenSec).map(formatCadence),
    weekend: nextWeekend(session.sessions, nowSec),
  };
}
