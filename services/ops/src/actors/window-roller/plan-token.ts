/**
 * What the roller does next on one 24/7 token Series (session-lanes.md §2.4): `tokenWindows` back-to-back with no
 * calendar, paused only by a halt of the xStock (§3.1; token halts are keyed by xStock, not ticker) or a corporate
 * action on the token lane (core `corporateActionFor`: token-lane date skips and multiplier changes inside the span).
 * Pure, like `plan.ts`. Lane 6b owns this file.
 *
 * A token Window's opening print is copied from the previous close (`public_copy_open_from_prev`) or printed from a
 * Switchboard quote inside `[T + 10, T + 60]`, so a late open still has to leave the relay `PRINT_MARGIN_SEC` before
 * `open_deadline`; after downtime the next aligned Window is the candidate. A valuation lane (S20) lists only while its
 * Pyth index is entitled (`clock.pythUsable`); otherwise it reads `paused: no signed source (Pyth feed not entitled)`.
 */
import { corporateActionFor, corporatePausedState, haltOf, haltPausedState, tokenLaneAsset, tokenWindows, type ScheduledWindow, type TickerSymbol } from "@agari/core/market";
import { BOUNDARY_KIND_U8, PRINT_MARGIN_SEC, spanOf, type PlanClock, type PlanSeries, type SeriesPlan } from "./plan";
import { describeVersion, highestCoveringVersion, noSourceState, openPrintsAdmissible, usableBy } from "./versions";

/** The earliest Window at or after `lastExpirySec` that can still be opened and take its opening print. */
export function nextTokenCandidate(series: PlanSeries, clock: PlanClock): ScheduledWindow {
  const cadence = series.cadenceSec;
  const from = Math.max(series.lastExpirySec, clock.nowSec - cadence);
  const windows = tokenWindows(from, Math.max(from, clock.nowSec) + clock.leadSec + 2 * cadence, cadence);
  const ok = windows.find((w) => {
    if (w.tradingStartSec < series.lastExpirySec || w.lockAtSec - clock.nowSec < clock.minTradableSec) return false;
    const version = highestCoveringVersion(series.versions, w.tradingStartSec, w.expirySec, usableBy(clock));
    return version === null || openPrintsAdmissible(series.versions[version]!, w, clock.nowSec, PRINT_MARGIN_SEC);
  });
  // `windows` always spans more than one cadence past the clock, so a later Window always qualifies.
  return ok ?? windows.at(-1)!;
}

function pauseReason(series: PlanSeries, w: ScheduledWindow, clock: PlanClock): string | null {
  const symbol = series.symbol as TickerSymbol;
  // The 24/7 asset: an xStock for a listed ticker, the PreStocks token for a pre-IPO name (D-103); halts key by it.
  const asset = tokenLaneAsset(symbol);
  if (!asset) return `paused: ${symbol} has no 24/7 token`;
  const halt = haltOf(clock.halts, asset);
  if (halt) return haltPausedState(halt);
  const action = corporateActionFor({ symbol, lane: "token", window: w }, clock.skips, clock.multipliers);
  return action ? corporatePausedState(action.why) : null;
}

export function planTokenSeries(series: PlanSeries, clock: PlanClock): SeriesPlan {
  const w = nextTokenCandidate(series, clock);
  const untilOpen = w.tradingStartSec - clock.nowSec;
  if (untilOpen > clock.leadSec) return { kind: "wait", window: w, wakeSec: w.tradingStartSec - clock.leadSec, state: `waiting: next ${spanOf(w)}` };
  const passSec = w.lockAtSec - clock.minTradableSec + 1;
  const paused = pauseReason(series, w, clock);
  if (paused) return { kind: "paused", window: w, wakeSec: passSec, state: paused };
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
    state: `opening #${series.nextIndex} ${spanOf(w)} ${describeVersion(version, series.versions[version]!)}`,
  };
}
