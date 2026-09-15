import type { SessionStatus, TradingSession } from "@agari/core/market";

/** The chart's spans. Only 1D reads today; 5D/1M/3M arrive with the Alpaca bars route (S18a stretch). */
export type HistoryRange = "1D" | "5D" | "1M" | "3M";
export const HISTORY_RANGES: readonly HistoryRange[] = ["1D"];

const MAX_STALE_MS = 6 * 3600 * 1000;
const MIN_STALE_MS = 60_000;

/** The last completed regular session and the one before it: the 1D chart's span and the two closes a day change needs. */
export interface ArchiveWindow {
  session: TradingSession;
  prev: TradingSession | null;
  fromSec: number;
  toSec: number;
}

/** Null before the calendar names a completed session. Keyed on session boundaries, so a read's key holds all night. */
export function archiveWindow(sessions: readonly TradingSession[], nowSec: number): ArchiveWindow | null {
  const done = sessions.filter((s) => s.closeSec <= nowSec).sort((a, b) => a.openSec - b.openSec);
  const session = done.at(-1);
  if (!session) return null;
  const prev = done.at(-2) ?? null;
  return { session, prev, fromSec: (prev ?? session).openSec, toSec: session.closeSec };
}

/** How long an archive read stays fresh: until the next session boundary can move the window, at most 6 h (D-086). */
export function archiveStaleMs(status: Pick<SessionStatus, "state" | "closesAtSec" | "nextOpenSec">, nowSec: number): number {
  const open = status.state === "regular" || status.state === "early-close" || status.state === "halted";
  const boundarySec = open ? status.closesAtSec : status.nextOpenSec;
  if (boundarySec === null) return MAX_STALE_MS;
  return Math.max(MIN_STALE_MS, Math.min(MAX_STALE_MS, (boundarySec - nowSec) * 1000));
}
