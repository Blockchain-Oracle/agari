/** Policy-version coverage, off-chain (prints.md §2.3): the same rule `roller_open_window` checks with `SourceNotCovered`. */

/** A stored version reduced to what listing needs. `validUntilSec` null = open-ended (`i64::MAX` on chain). */
export interface VersionWindow {
  validFromSec: number;
  validUntilSec: number | null;
  primarySource: number;
  checkSource: number;
  /** `primary.open_admission_sec`; `ADMIT_UNTIL_LOCK` (u32::MAX) admits until `lock_at`. */
  openAdmissionSec: number;
  /** `check_admission_sec` (0 without a check). */
  checkAdmissionSec: number;
  /** `primary.feed_id` as lower-case hex: what `PlanClock.pythUsable` judges a Pyth version by (S20). */
  primaryFeedIdHex: string;
}

/** Whether a covering version may be listed on now: false for a Pyth version whose feed the key is not entitled to (S20). */
export type VersionUsable = (v: VersionWindow) => boolean;
export const EVERY_VERSION_USABLE: VersionUsable = () => true;
export const SOURCE_PYTH = 1;

/** `PrintPolicy.source` numbering (prints.md §2.1). */
export const SOURCE_NAME: Record<number, string> = { 0: "none", 1: "pyth", 2: "redstone", 3: "switchboard", 4: "attested" };

const I64_MAX = 9_223_372_036_854_775_807n;

/** From a decoded `PolicyVersion` (chain) or `PolicyVersionArgs` (price-sources.json). */
export function versionWindow(v: {
  validFromTs: bigint;
  validUntilTs: bigint;
  primary: { source: number; openAdmissionSec: number; feedId: ArrayLike<number> };
  check: { source: number };
  checkAdmissionSec: number;
}): VersionWindow {
  return {
    validFromSec: Number(v.validFromTs),
    validUntilSec: v.validUntilTs === I64_MAX ? null : Number(v.validUntilTs),
    primarySource: v.primary.source,
    checkSource: v.check.source,
    openAdmissionSec: v.primary.openAdmissionSec,
    checkAdmissionSec: v.checkAdmissionSec,
    primaryFeedIdHex: Array.from(v.primary.feedId, (b) => b.toString(16).padStart(2, "0")).join(""),
  };
}

const ADMIT_UNTIL_LOCK = 0xffff_ffff;

/**
 * Whether a Window opened now can still take its opening prints (prints.md §3): the primary open before
 * `open_deadline` and, when the version has a check, the check open before `T + check_admission_sec`, each with
 * `marginSec` for the relay to fetch and record. A late open would otherwise void at once (no open print) or settle
 * single-source (check missed), so the roller skips to the next Window instead.
 */
export function openPrintsAdmissible(v: VersionWindow, w: { tradingStartSec: number; lockAtSec: number }, nowSec: number, marginSec: number): boolean {
  const openDeadline = v.openAdmissionSec === ADMIT_UNTIL_LOCK ? w.lockAtSec : w.tradingStartSec + v.openAdmissionSec;
  if (nowSec + marginSec > openDeadline) return false;
  return v.checkSource === 0 || nowSec + marginSec <= w.tradingStartSec + v.checkAdmissionSec;
}

const covers = (v: VersionWindow, startSec: number, expirySec: number) =>
  v.validFromSec <= startSec && (v.validUntilSec === null || expirySec <= v.validUntilSec);

/**
 * `max { i : covers(v_i, W) ∧ usable(v_i) }`, or null: the Window is not listed. `usable` (S20) skips a covering Pyth
 * version whose feed the key may not read, so a valuation lane opens nothing that could not settle, and the chain's own
 * `SourceNotCovered` rule (which knows nothing of entitlement) is never the thing that stops it.
 */
export function highestCoveringVersion(versions: readonly VersionWindow[], startSec: number, expirySec: number, usable: VersionUsable = EVERY_VERSION_USABLE): number | null {
  for (let i = versions.length - 1; i >= 0; i--) if (covers(versions[i]!, startSec, expirySec) && usable(versions[i]!)) return i;
  return null;
}

export const PAUSED_NO_SOURCE = "paused: no signed source";
export const PAUSED_NOT_ENTITLED = "paused: no signed source (Pyth feed not entitled)";

/** The lane state when nothing lists: a covering version exists but its Pyth feed is not entitled, or no version covers the Window at all. */
export function noSourceState(versions: readonly VersionWindow[], startSec: number, expirySec: number, usable: VersionUsable): string {
  return highestCoveringVersion(versions, startSec, expirySec) !== null && highestCoveringVersion(versions, startSec, expirySec, usable) === null ? PAUSED_NOT_ENTITLED : PAUSED_NO_SOURCE;
}

/** The roller's predicate from its clock: every non-Pyth version is usable; a Pyth version follows `clock.pythUsable` on its feed. */
export const usableBy = (clock: { pythUsable: (feedIdHex: string) => boolean }): VersionUsable => (v) => v.primarySource !== SOURCE_PYTH || clock.pythUsable(v.primaryFeedIdHex);

/** `v2 redstone`, `v1 pyth+redstone` (1-based like price-sources.json). */
export function describeVersion(index: number, v: VersionWindow): string {
  const check = v.checkSource === 0 ? "" : `+${SOURCE_NAME[v.checkSource] ?? v.checkSource}`;
  return `v${index + 1} ${SOURCE_NAME[v.primarySource] ?? v.primarySource}${check}`;
}
