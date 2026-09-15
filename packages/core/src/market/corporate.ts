import type { LaneBasis } from "../types/market";
import type { CorporateSkip, MultiplierChange } from "../types/session-lanes";
import { etDateOf } from "./et-time";
import { TICKERS, type TickerSymbol } from "./tickers";

/**
 * Corporate actions (session-lanes.md §3.4, D-057): `services/ops/config/corporate-actions.json` names split days
 * (`skips[]`, optionally per lane) and xStock multiplier changes (`multipliers[]`). A match pauses the lane with
 * `paused: corporate action (<why>)`; entries are proposed by `scripts/drive/corporate-check.ts` and committed by a person.
 */

export interface SkipWindow {
  tradingStartSec: number;
  expirySec: number;
}

/**
 * Whether a date skip pauses a Window on `lane` (the caller matches the ticker). A skip without `lanes` covers every lane.
 * - Regular: the start's ET date.
 * - Gap: its Friday **or** its Monday (the start's or the expiry's ET date), so a split either side of a weekend skips it.
 * - Token: either boundary's ET date. Multiplier changes are the token lane's own rule (`multiplierApplies`).
 */
export function skipApplies(skip: CorporateSkip, window: SkipWindow, lane: LaneBasis): boolean {
  if (skip.lanes && !skip.lanes.includes(lane)) return false;
  const start = etDateOf(window.tradingStartSec);
  if (lane === "regular") return skip.date === start;
  return skip.date === start || skip.date === etDateOf(window.expirySec);
}

/** A multiplier change inside `(tradingStart, expiry]`: the token's UI price jumps mid-Window, so that Window is skipped. */
export function multiplierApplies(change: MultiplierChange, window: SkipWindow): boolean {
  return window.tradingStartSec < change.effectiveSec && change.effectiveSec <= window.expirySec;
}

/** The first corporate action that pauses this Window, or null. Token lanes also check their xStock's multipliers. */
export function corporateActionFor(
  input: { symbol: TickerSymbol; lane: LaneBasis; window: SkipWindow },
  skips: readonly CorporateSkip[],
  multipliers: readonly MultiplierChange[] = [],
): { why: string } | null {
  const skip = skips.find((k) => k.symbol === input.symbol && skipApplies(k, input.window, input.lane));
  if (skip) return { why: skip.why };
  if (input.lane !== "token") return null;
  const xstock = TICKERS[input.symbol].xstock?.symbol;
  const change = multipliers.find((m) => m.xstock === xstock && multiplierApplies(m, input.window));
  return change ? { why: change.why } : null;
}

export function corporatePausedState(why: string): string {
  return `paused: corporate action (${why})`;
}
