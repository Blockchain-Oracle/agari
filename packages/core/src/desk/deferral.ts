/**
 * "Wait" is remembered (desk.md §8). Once the desk has decided to wait, it does not put the same question to the model
 * again every hour. The wait stands until a day has passed, or until something MEASURABLE changes. Every test here is
 * arithmetic, so a standing wait costs no model call and reads "still waiting (decided 02:00)".
 */
import { deskCopy } from "./copy";
import { MIN_TRADE_E6 } from "./needs";

/** A wait ends on its own after this long: there is no market reopen on a 24/7 lane, so a day is the horizon. */
export const DEFERRAL_MAX_SEC = 86_400;
/** The premium (spot against mark) moved this much since the wait was decided. */
export const PREMIUM_MOVE_BPS = 100;
/** The spot moved this much since the wait was decided. */
export const SPOT_MOVE_BPS = 200;

/**
 * The numbers a remembered decision was made on. Later hours are compared against these.
 *
 * `wait`        the model said wait.
 * `would_have`  PRACTICE ONLY. The desk would have acted. A live desk would have traded once and then had nothing to
 *               do; a practice desk's paper ledger moves instead, so this memory only ends on new cash or a day.
 */
export interface DeferralBaseline {
  kind: "wait" | "would_have";
  decisionSeq: number;
  decidedAtSec: number;
  premiumBps: number | null;
  /** Decimal strings: a baseline is stored in the record and the database. */
  spotE8: string;
  driftBps: number;
  cashE6: string;
}

export interface DeferralNow {
  atSec: number;
  premiumBps: number | null;
  spotE8: bigint;
  driftBps: number;
  cashE6: bigint;
}

export type DeferralEnd = { status: "revisited" | "broken"; reason: string };

const bpsBetween = (a: bigint, b: bigint): number => (b === 0n ? 0 : Number(((a - b) * 10_000n) / b));

/** null means the wait still stands. Otherwise how it ended, in words for the record. */
export function whyDeferralEnds(baseline: DeferralBaseline, now: DeferralNow, toleranceBps: number): DeferralEnd | null {
  if (now.atSec >= baseline.decidedAtSec + DEFERRAL_MAX_SEC) return { status: "revisited", reason: deskCopy.remembered.dayPassed };
  if (now.cashE6 >= BigInt(baseline.cashE6) + MIN_TRADE_E6) return { status: "broken", reason: deskCopy.remembered.cashArrived };
  // A live desk that had already traded would not trade again because the price moved.
  if (baseline.kind === "would_have") return null;

  if (baseline.premiumBps !== null && now.premiumBps !== null) {
    const premiumMove = Math.abs(now.premiumBps - baseline.premiumBps);
    if (premiumMove >= PREMIUM_MOVE_BPS) return { status: "broken", reason: deskCopy.remembered.premiumMoved(premiumMove) };
  }
  const spotMove = Math.abs(bpsBetween(now.spotE8, BigInt(baseline.spotE8)));
  if (spotMove >= SPOT_MOVE_BPS) return { status: "broken", reason: deskCopy.remembered.spotMoved(spotMove) };
  const driftGrowth = Math.abs(now.driftBps) - Math.abs(baseline.driftBps);
  if (driftGrowth >= toleranceBps / 2) return { status: "broken", reason: deskCopy.remembered.driftGrew(driftGrowth) };
  return null;
}
