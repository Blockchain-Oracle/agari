/**
 * What the roller does next on one Regular Series (venue-ops.md §5.2). Pure: plain Series data, the agreed calendar
 * and the chain clock in, one decision out. The executor recycles Books before it asks, and re-reads before it sends.
 */
import {
  corporateActionFor,
  corporatePausedState,
  haltOf,
  haltPausedState,
  regularWindows,
  type BoundaryKind,
  type HaltAsset,
  type ScheduledWindow,
  type SessionCalendar,
  type TickerSymbol,
} from "@agari/core/market";
import type { CorporateSkip, HaltBoard, MultiplierChange } from "@agari/core/types";
import { describeVersion, highestCoveringVersion, noSourceState, openPrintsAdmissible, usableBy, type VersionWindow } from "./versions";

/** `BoundaryKind` as `roller_open_window` takes it (events-accounts.md §2). */
export const BOUNDARY_KIND_U8: Record<BoundaryKind, number> = { Intraday: 0, SessionOpen: 1, SessionClose: 2 };

export type { CorporateSkip };

export interface PlanSeries {
  /** The lane key: `TSLA-5m`, `TSLA-gap`, `TSLAx-5m` (core `laneKey`). */
  key: string;
  symbol: string;
  cadenceSec: number;
  /** `series.max_lead_sec`: how far ahead the chain lets this Series list (`check_window` step 8). */
  maxLeadSec: number;
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
  /** Open a Window at most this long before its trading start (< cadence, so two Books suffice). Regular and token lanes. */
  leadSec: number;
  /** The Gap lane's listing lead (`ROLLER_GAP_LEAD_SEC`, session-lanes.md §1.4): the 09-18 Gap lists from Wednesday 16:00 ET. */
  gapLeadSec: number;
  /** Never open a Window with less than this left before `lock_at`. */
  minTradableSec: number;
  /** Prelist the next session's first Regular Window at the previous close (`ROLLER_PRELIST`, D-089). */
  prelist: boolean;
  /** Cadences the prelist covers (`ROLLER_PRELIST_CADENCES`): a narrower set holds less SOL float overnight. */
  prelistCadencesSec: readonly number[];
  skips: readonly CorporateSkip[];
  /** xStock multiplier changes (token lane only, core `multiplierApplies`). */
  multipliers: readonly MultiplierChange[];
  /** `deps.halts.board()` at plan time: keyed by ticker for Regular/Gap, by xStock for token (session-lanes.md §3.1). */
  halts: HaltBoard;
  /** Whether a Pyth version naming this feed may list (S20): a trial feed always, a valuation index only while the key is entitled. */
  pythUsable: (feedIdHex: string) => boolean;
}

export type SeriesPlan =
  | { kind: "open"; window: ScheduledWindow; index: bigint; policyVersion: number; openKind: number; closeKind: number; book: string; state: string }
  | { kind: "wait"; window: ScheduledWindow; wakeSec: number; state: string }
  | { kind: "paused"; window: ScheduledWindow; wakeSec: number; state: string }
  | { kind: "blocked"; window: ScheduledWindow; state: string }
  | { kind: "closed"; wakeSec: number | null; state: string };

export const DEFAULT_LEAD_SEC = 120;
export const DEFAULT_PRELIST = true;
export const DEFAULT_PRELIST_CADENCES_SEC = [300, 900, 3_600];
/** Kept in reserve from the Series' `max_lead_sec`, so a prelist never races the chain's own horizon check. */
export const PRELIST_MARGIN_SEC = 3_600;
export const DEFAULT_GAP_LEAD_SEC = 172_800;
export const DEFAULT_MIN_TRADABLE_SEC = 60;
/** Time the relay needs after a late open to fetch and record the opening prints before their deadline. */
export const PRINT_MARGIN_SEC = 45;

const hhmm = (sec: number) => new Date(sec * 1000).toISOString().slice(11, 16);
export const spanOf = (w: { tradingStartSec: number; expirySec: number }) => `${hhmm(w.tradingStartSec)}–${hhmm(w.expirySec)}Z`;

/** The close of the session in progress, or null when nothing is trading. */
export function liveSessionCloseSec(clock: PlanClock): number | null {
  return clock.calendar?.sessions.find((s) => s.openSec <= clock.nowSec && clock.nowSec < s.closeSec)?.closeSec ?? null;
}

/** This Series' first Window of the first session that hasn't opened yet (60m starts at 10:00 ET, not the bell). */
function firstWindowOfNextSession(series: PlanSeries, clock: PlanClock): ScheduledWindow | null {
  const next = clock.calendar?.sessions.find((s) => s.openSec > clock.nowSec);
  return next ? (regularWindows(next, series.cadenceSec)[0] ?? null) : null;
}

/**
 * Whether `w` may be listed before its lead (D-089): the Series' first Window of the next session, once nothing is
 * trading and the Series' own horizon has room to spare. Users can then rest pre-open calls on it overnight.
 */
export function prelistable(series: PlanSeries, clock: PlanClock, w: ScheduledWindow): boolean {
  if (!clock.prelist || !clock.prelistCadencesSec.includes(series.cadenceSec)) return false;
  if (liveSessionCloseSec(clock) !== null) return false;
  if (firstWindowOfNextSession(series, clock)?.tradingStartSec !== w.tradingStartSec) return false;
  return w.tradingStartSec - clock.nowSec <= series.maxLeadSec - PRELIST_MARGIN_SEC;
}

/** The same Window, before the horizon or the close lets it list: what the lane is waiting for. */
function prelistWait(series: PlanSeries, clock: PlanClock, w: ScheduledWindow): SeriesPlan | null {
  if (!clock.prelist || !clock.prelistCadencesSec.includes(series.cadenceSec)) return null;
  if (firstWindowOfNextSession(series, clock)?.tradingStartSec !== w.tradingStartSec) return null;
  // Whichever comes first: the session's close, the Series' horizon reaching back this far, or the ordinary lead.
  const horizonSec = w.tradingStartSec - series.maxLeadSec + PRELIST_MARGIN_SEC;
  const live = liveSessionCloseSec(clock);
  const wakeSec = Math.min(w.tradingStartSec - clock.leadSec, live ?? Number.MAX_SAFE_INTEGER, horizonSec > clock.nowSec ? horizonSec : Number.MAX_SAFE_INTEGER);
  return { kind: "wait", window: w, wakeSec, state: `waiting: lists at the close for ${spanOf(w)}` };
}

/** The earliest Window of today's or the next session that can still be opened on this Series. */
export function nextCandidate(series: PlanSeries, clock: PlanClock): ScheduledWindow | null {
  if (!clock.calendar) return null;
  const sessions = clock.calendar.sessions.filter((s) => s.closeSec > clock.nowSec).slice(0, 2);
  const windows = sessions.flatMap((s) => regularWindows(s, series.cadenceSec));
  return (
    windows.find((w) => {
      if (w.tradingStartSec < series.lastExpirySec || w.lockAtSec - clock.nowSec < clock.minTradableSec) return false;
      // An uncovered Window stays the candidate so the lane reports "paused"; a covered one must still take its open prints.
      const version = highestCoveringVersion(series.versions, w.tradingStartSec, w.expirySec, usableBy(clock));
      return version === null || openPrintsAdmissible(series.versions[version]!, w, clock.nowSec, PRINT_MARGIN_SEC);
    }) ?? null
  );
}

export function planSeries(series: PlanSeries, clock: PlanClock): SeriesPlan {
  if (!clock.calendar) return { kind: "closed", wakeSec: null, state: "closed: no calendar" };
  const w = nextCandidate(series, clock);
  if (!w) return { kind: "closed", wakeSec: null, state: "closed: no session" };
  const untilOpen = w.tradingStartSec - clock.nowSec;
  const prelist = untilOpen > clock.leadSec && prelistable(series, clock, w);
  if (untilOpen > clock.leadSec && !prelist) {
    // The prelist's own wait: it lists at the close, or once the Series' horizon reaches back this far.
    const waiting = prelistWait(series, clock, w);
    if (waiting) return waiting;
    const state = untilOpen <= series.cadenceSec ? `waiting: next ${spanOf(w)}` : "closed: no session";
    return { kind: "wait", window: w, wakeSec: w.tradingStartSec - clock.leadSec, state };
  }
  const passSec = w.lockAtSec - clock.minTradableSec + 1;
  const halt = haltOf(clock.halts, series.symbol as HaltAsset);
  if (halt) return { kind: "paused", window: w, wakeSec: passSec, state: haltPausedState(halt) };
  const action = corporateActionFor({ symbol: series.symbol as TickerSymbol, lane: "regular", window: w }, clock.skips);
  if (action) return { kind: "paused", window: w, wakeSec: passSec, state: corporatePausedState(action.why) };
  const version = highestCoveringVersion(series.versions, w.tradingStartSec, w.expirySec, usableBy(clock));
  if (version === null) return { kind: "paused", window: w, wakeSec: passSec, state: noSourceState(series.versions, w.tradingStartSec, w.expirySec, usableBy(clock)) };
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
    state: `${prelist ? "prelisting" : "opening"} #${series.nextIndex} ${spanOf(w)} ${describeVersion(version, series.versions[version]!)}`,
  };
}
