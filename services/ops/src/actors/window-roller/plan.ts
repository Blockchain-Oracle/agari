/**
 * What the roller does next on one Regular Series (venue-ops.md §5.2). Pure: plain Series data, the agreed calendar
 * and the chain clock in, one decision out. The executor recycles Books before it asks, and re-reads before it sends.
 */
import { etDateOf, regularWindows, type BoundaryKind, type ScheduledWindow, type SessionCalendar } from "@agari/core/market";
import { describeVersion, highestCoveringVersion, openPrintsAdmissible, type VersionWindow } from "./versions";

/** `BoundaryKind` as `roller_open_window` takes it (events-accounts.md §2). */
export const BOUNDARY_KIND_U8: Record<BoundaryKind, number> = { Intraday: 0, SessionOpen: 1, SessionClose: 2 };

export interface CorporateSkip {
  symbol: string;
  /** ET date. */
  date: string;
  why: string;
}

export interface PlanSeries {
  /** `TSLA-5m`. */
  key: string;
  symbol: string;
  cadenceSec: number;
  nextIndex: bigint;
  lastExpirySec: number;
  versions: readonly VersionWindow[];
  /** `series.free_books[..free_book_count]`. */
  freeBooks: readonly string[];
}

export interface PlanClock {
  calendar: SessionCalendar | null;
  /** The chain clock. */
  nowSec: number;
  /** Open a Window at most this long before its trading start (< cadence, so two Books suffice). */
  leadSec: number;
  /** Never open a Window with less than this left before `lock_at`. */
  minTradableSec: number;
  skips: readonly CorporateSkip[];
}

export type SeriesPlan =
  | { kind: "open"; window: ScheduledWindow; index: bigint; policyVersion: number; openKind: number; closeKind: number; book: string; state: string }
  | { kind: "wait"; window: ScheduledWindow; wakeSec: number; state: string }
  | { kind: "paused"; window: ScheduledWindow; wakeSec: number; state: string }
  | { kind: "blocked"; window: ScheduledWindow; state: string }
  | { kind: "closed"; wakeSec: number | null; state: string };

export const DEFAULT_LEAD_SEC = 120;
export const DEFAULT_MIN_TRADABLE_SEC = 60;
/** Time the relay needs after a late open to fetch and record the opening prints before their deadline. */
export const PRINT_MARGIN_SEC = 45;

const hhmm = (sec: number) => new Date(sec * 1000).toISOString().slice(11, 16);
export const spanOf = (w: { tradingStartSec: number; expirySec: number }) => `${hhmm(w.tradingStartSec)}–${hhmm(w.expirySec)}Z`;

/** The earliest Window of today's or the next session that can still be opened on this Series. */
export function nextCandidate(series: PlanSeries, clock: PlanClock): ScheduledWindow | null {
  if (!clock.calendar) return null;
  const sessions = clock.calendar.sessions.filter((s) => s.closeSec > clock.nowSec).slice(0, 2);
  const windows = sessions.flatMap((s) => regularWindows(s, series.cadenceSec));
  return (
    windows.find((w) => {
      if (w.tradingStartSec < series.lastExpirySec || w.lockAtSec - clock.nowSec < clock.minTradableSec) return false;
      // An uncovered Window stays the candidate so the lane reports "paused"; a covered one must still take its open prints.
      const version = highestCoveringVersion(series.versions, w.tradingStartSec, w.expirySec);
      return version === null || openPrintsAdmissible(series.versions[version]!, w, clock.nowSec, PRINT_MARGIN_SEC);
    }) ?? null
  );
}

export function planSeries(series: PlanSeries, clock: PlanClock): SeriesPlan {
  if (!clock.calendar) return { kind: "closed", wakeSec: null, state: "closed: no calendar" };
  const w = nextCandidate(series, clock);
  if (!w) return { kind: "closed", wakeSec: null, state: "closed: no session" };
  const untilOpen = w.tradingStartSec - clock.nowSec;
  if (untilOpen > clock.leadSec) {
    const state = untilOpen <= series.cadenceSec ? `waiting: next ${spanOf(w)}` : "closed: no session";
    return { kind: "wait", window: w, wakeSec: w.tradingStartSec - clock.leadSec, state };
  }
  const passSec = w.lockAtSec - clock.minTradableSec + 1;
  const skip = clock.skips.find((k) => k.symbol === series.symbol && k.date === etDateOf(w.tradingStartSec));
  if (skip) return { kind: "paused", window: w, wakeSec: passSec, state: `paused: corporate action (${skip.why})` };
  const version = highestCoveringVersion(series.versions, w.tradingStartSec, w.expirySec);
  if (version === null) return { kind: "paused", window: w, wakeSec: passSec, state: "paused: no signed source" };
  const book = series.freeBooks[0];
  if (!book) return { kind: "blocked", window: w, state: "waiting: no free book" };
  return {
    kind: "open",
    window: w,
    index: series.nextIndex,
    policyVersion: version,
    openKind: BOUNDARY_KIND_U8[w.openKind],
    closeKind: BOUNDARY_KIND_U8[w.closeKind],
    book,
    state: `opening #${series.nextIndex} ${spanOf(w)} ${describeVersion(version, series.versions[version]!)}`,
  };
}
