import { parseLaneKey, regularWindows, type TickerSymbol, type TradingSession } from "@agari/core/market";
import type { EventMarket, LaneSet } from "@agari/core/types";
import type { MarketSession } from "../session";
import { compareLaneTabKeys, laneTabKey, laneTabParts, type LaneTabKey } from "./lane-view";

/**
 * What lists next when nothing is live (D-086): the lanes ops configures (`/session.lanes`, keyed by core `laneKey`)
 * stand in for the live Windows, so the tabs and the rail never empty. Pure over the session value.
 */

/** Every configured lane as a tab key, in board order, whether or not a Window is live in it. */
export function configuredLaneKeys(session: MarketSession | null): LaneTabKey[] {
  if (!session) return [];
  const keys = new Set<LaneTabKey>();
  for (const key of Object.keys(session.lanes)) {
    const parts = parseLaneKey(key);
    if (parts) keys.add(laneTabKey(parts.basis, parts.cadenceSec));
  }
  return [...keys].sort(compareLaneTabKeys);
}

/** The tickers ops configures in one lane, registry order. */
export function configuredTickers(session: MarketSession | null, key: LaneTabKey): TickerSymbol[] {
  if (!session) return [];
  const { basis, intervalSec } = laneTabParts(key);
  const out: TickerSymbol[] = [];
  for (const laneName of Object.keys(session.lanes)) {
    const parts = parseLaneKey(laneName);
    if (parts && parts.basis === basis && parts.cadenceSec === intervalSec && !out.includes(parts.symbol)) out.push(parts.symbol);
  }
  return out;
}

/** The next regular session: the one opening at `status.nextOpenSec`, when the calendar names it. */
export function nextSession(session: MarketSession): TradingSession | null {
  const openSec = session.status.nextOpenSec;
  return openSec === null ? null : (session.sessions.find((s) => s.openSec === openSec) ?? null);
}

/**
 * When a lane's first Window of the next session starts: core's own schedule, so the 60m lane says 10:00 and not 09:30
 * (`regularWindows` aligns to the clock). Null when the calendar does not name the next session.
 */
export function firstWindowStartSec(session: MarketSession, cadenceSec: number): number | null {
  const next = nextSession(session);
  if (!next) return null;
  try {
    return regularWindows(next, cadenceSec)[0]?.tradingStartSec ?? null;
  } catch {
    return null;
  }
}

/**
 * The asset's next listed Regular Window (D-088): on the Book before its open, so a call can rest on it. The site's own
 * cadence first (a 5m card offers the 5m Window), else the soonest of any Regular lane (a lane with no free Book has
 * none, and the 60m Window that opens at 10:00 is still a call to schedule). Null when nothing is listed yet.
 */
export function nextListedWindow(laneSet: LaneSet | null, asset: TickerSymbol, nowSec: number, intervalSec?: number): EventMarket | null {
  if (!laneSet) return null;
  const listed = laneSet.lanes
    .filter((lane) => lane.basis === "regular")
    .flatMap((lane) => lane.markets)
    .filter((m) => m.asset === asset && m.tradingStartSec > nowSec && !m.voided)
    .sort((a, b) => a.tradingStartSec - b.tradingStartSec);
  return listed.find((m) => m.intervalSec === intervalSec) ?? listed[0] ?? null;
}
