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
}

/** `PrintPolicy.source` numbering (prints.md §2.1). */
export const SOURCE_NAME: Record<number, string> = { 0: "none", 1: "pyth", 2: "redstone", 3: "switchboard", 4: "attested" };

const I64_MAX = 9_223_372_036_854_775_807n;

/** From a decoded `PolicyVersion` (chain) or `PolicyVersionArgs` (price-sources.json). */
export function versionWindow(v: {
  validFromTs: bigint;
  validUntilTs: bigint;
  primary: { source: number; openAdmissionSec: number };
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

/** `max { i : covers(v_i, W) }`, or null: the Window is not listed ("paused: no signed source"). */
export function highestCoveringVersion(versions: readonly VersionWindow[], startSec: number, expirySec: number): number | null {
  for (let i = versions.length - 1; i >= 0; i--) if (covers(versions[i]!, startSec, expirySec)) return i;
  return null;
}

/** `v2 redstone`, `v1 pyth+redstone` (1-based like price-sources.json). */
export function describeVersion(index: number, v: VersionWindow): string {
  const check = v.checkSource === 0 ? "" : `+${SOURCE_NAME[v.checkSource] ?? v.checkSource}`;
  return `v${index + 1} ${SOURCE_NAME[v.primarySource] ?? v.primarySource}${check}`;
}
