/**
 * What the roller does next on one Gap Series (session-lanes.md §1.4): the earliest `gapWindows` candidate inside
 * `gapLeadSec`, the check-bound exception, and the corporate skip on either the Friday or the Monday. Pure, like
 * `plan.ts`. Lane 6a owns this file.
 */
import { etDateOf, gapWindows, type ScheduledWindow } from "@agari/core/market";
import { BOUNDARY_KIND_U8, PRINT_MARGIN_SEC, type PlanClock, type PlanSeries, type SeriesPlan } from "./plan";
import { describeVersion, highestCoveringVersion, openPrintsAdmissible } from "./versions";

const day = (sec: number) => new Date(sec * 1000).toISOString().slice(5, 16).replace("T", " ");
/** `09-18 20:00Z–09-21 13:30Z`: a Gap spans days, so the Regular `HH:MM–HH:MMZ` would be ambiguous. */
export const gapSpanOf = (w: { tradingStartSec: number; expirySec: number }) => `${day(w.tradingStartSec)}Z–${day(w.expirySec)}Z`;

/**
 * The earliest weekend Window that can still be opened. An uncovered Window stays the candidate so the lane reports
 * "paused". A covered one must still take its opening print (`now + 45 ≤ open_deadline`), but not its check open: a
 * Gap past its check bound lists and settles single-source, because the next candidate is a week away.
 */
export function nextGapCandidate(series: PlanSeries, clock: PlanClock): ScheduledWindow | null {
  if (!clock.calendar) return null;
  return (
    gapWindows(clock.calendar).find((w) => {
      if (w.tradingStartSec < series.lastExpirySec || w.lockAtSec - clock.nowSec < clock.minTradableSec) return false;
      const version = highestCoveringVersion(series.versions, w.tradingStartSec, w.expirySec);
      return version === null || openPrintsAdmissible({ ...series.versions[version]!, checkSource: 0 }, w, clock.nowSec, PRINT_MARGIN_SEC);
    }) ?? null
  );
}

/** A skip names an ET date; a Gap matches its Friday (the opening session's date) or its Monday (the closing one's). */
export function gapSkip(series: PlanSeries, clock: PlanClock, w: ScheduledWindow) {
  const dates = [etDateOf(w.tradingStartSec), etDateOf(w.expirySec)];
  return clock.skips.find((k) => k.symbol === series.symbol && (!k.lanes || k.lanes.includes("gap")) && dates.includes(k.date)) ?? null;
}

export function planGapSeries(series: PlanSeries, clock: PlanClock): SeriesPlan {
  if (!clock.calendar) return { kind: "closed", wakeSec: null, state: "closed: no calendar" };
  const w = nextGapCandidate(series, clock);
  if (!w) return { kind: "closed", wakeSec: null, state: "closed: no weekend in the calendar" };
  const listSec = w.tradingStartSec - clock.gapLeadSec;
  if (clock.nowSec < listSec) return { kind: "wait", window: w, wakeSec: listSec, state: `waiting: lists ${day(listSec)}Z for ${gapSpanOf(w)}` };
  const passSec = w.lockAtSec - clock.minTradableSec + 1;
  const skip = gapSkip(series, clock, w);
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
    state: `opening #${series.nextIndex} ${gapSpanOf(w)} ${describeVersion(version, series.versions[version]!)}`,
  };
}
