/**
 * What the roller does next on one 24/7 token Series (session-lanes.md §2.4): `tokenWindows` back-to-back with no
 * calendar, skipped only for multiplier changes (§3.4), token-lane corporate skips and halts of the xStock (§3.1).
 * Pure, like `plan.ts`. Lane 6b owns this file.
 *
 * A token Window's opening print is copied from the previous close (`public_copy_open_from_prev`) or printed from a
 * Switchboard quote inside `[T + 10, T + 60]`, so a late open still has to leave the relay `PRINT_MARGIN_SEC` before
 * `open_deadline`; after downtime the next aligned Window is the candidate.
 */
import { etDateOf, TICKERS, tokenWindows, type ScheduledWindow, type TickerSymbol } from "@agari/core/market";
import type { HaltBoard, MultiplierChange } from "@agari/core/types";
import { BOUNDARY_KIND_U8, PRINT_MARGIN_SEC, spanOf, type PlanClock, type PlanSeries, type SeriesPlan } from "./plan";
import { describeVersion, highestCoveringVersion, openPrintsAdmissible } from "./versions";

/**
 * The roller's clock plus the token-lane inputs it will carry once the executor passes them (`deps.events.multipliers()`,
 * `deps.halts`); without them a token Series lists on skips and coverage alone.
 */
export type TokenPlanClock = PlanClock & { multipliers?: readonly MultiplierChange[]; halts?: HaltBoard };

/** The earliest Window at or after `lastExpirySec` that can still be opened and take its opening print. */
export function nextTokenCandidate(series: PlanSeries, clock: TokenPlanClock): ScheduledWindow {
  const cadence = series.cadenceSec;
  const from = Math.max(series.lastExpirySec, clock.nowSec - cadence);
  const windows = tokenWindows(from, Math.max(from, clock.nowSec) + clock.leadSec + 2 * cadence, cadence);
  const ok = windows.find((w) => {
    if (w.tradingStartSec < series.lastExpirySec || w.lockAtSec - clock.nowSec < clock.minTradableSec) return false;
    const version = highestCoveringVersion(series.versions, w.tradingStartSec, w.expirySec);
    return version === null || openPrintsAdmissible(series.versions[version]!, w, clock.nowSec, PRINT_MARGIN_SEC);
  });
  // `windows` always spans more than one cadence past the clock, so a later Window always qualifies.
  return ok ?? windows.at(-1)!;
}

function pauseReason(series: PlanSeries, w: ScheduledWindow, clock: TokenPlanClock): string | null {
  const xstock = TICKERS[series.symbol as TickerSymbol]?.xstock?.symbol;
  const halt = xstock ? clock.halts?.[xstock] : undefined;
  if (halt) return `paused: halted (${halt.reason})`;
  const skip = clock.skips.find((k) => k.symbol === series.symbol && k.lanes?.includes("token") && k.date === etDateOf(w.tradingStartSec));
  if (skip) return `paused: corporate action (${skip.why})`;
  const change = clock.multipliers?.find((m) => m.xstock === xstock && w.tradingStartSec < m.effectiveSec && m.effectiveSec <= w.expirySec);
  if (change) return `paused: corporate action (${change.why})`;
  return null;
}

export function planTokenSeries(series: PlanSeries, clock: TokenPlanClock): SeriesPlan {
  const w = nextTokenCandidate(series, clock);
  const untilOpen = w.tradingStartSec - clock.nowSec;
  if (untilOpen > clock.leadSec) return { kind: "wait", window: w, wakeSec: w.tradingStartSec - clock.leadSec, state: `waiting: next ${spanOf(w)}` };
  const passSec = w.lockAtSec - clock.minTradableSec + 1;
  const paused = pauseReason(series, w, clock);
  if (paused) return { kind: "paused", window: w, wakeSec: passSec, state: paused };
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
