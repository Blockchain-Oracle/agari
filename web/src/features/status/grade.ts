import { SOL_FAUCET_POLICY } from "@agari/core/faucet";

/**
 * The `/status` thresholds (proof-analytics.md §2.5), pure so they can be checked without a live soak.
 * Every input is an integer as the source reported it; divergence is integer centi-bps.
 */
export type Verdict = "good" | "warn" | "bad";

/** Regular hours, early close included: the only states in which Regular Windows run. */
export const SESSION_OPEN_STATES: readonly string[] = ["regular", "early-close"];

export const SLOT_LAG = { good: 50, warn: 300 } as const;
/** Live lag under 10 s is the S3 gate. */
export const INDEXER_LAG_SEC = { good: 10, warn: 60 } as const;
export const RELAY_RECORD_LAG_SEC = { good: 30, warn: 120 } as const;
/** A boundary is due fully recorded once this long has passed (RedStone's 300 s strict window + 30 s). */
export const RELAY_DUE_AFTER_SEC = 330;
/** Max divergence ≤ 10 bps is good; ≤ 25 bps (`price-sources.json` `crossCheck.maxDivergenceBps`) warns. */
export const CROSS_CHECK_CENTI_BPS = { good: 1_000n, warn: 2_500n } as const;
export const ARCHIVE = { goodFetchMs: 20_000, warnFetchMs: 60_000, goodSigners: 5, minSigners: 3 } as const;
/** `services/ops/src/http/health.ts`: silent after max(5 min, 3 × the loop), failing at 3 consecutive passes. */
export const HEARTBEAT = { silentMs: 300_000, failing: 3 } as const;
/** More than this many trial sessions left is good; fewer warns (the spec has no bad state: the trial ending is honest). */
export const TRIAL_SESSIONS_WARN = 3;

const ladder = (value: number, good: number, warn: number): Verdict => (value <= good ? "good" : value <= warn ? "warn" : "bad");
export const worst = (...verdicts: Verdict[]): Verdict => (verdicts.includes("bad") ? "bad" : verdicts.includes("warn") ? "warn" : "good");

export function gradeSlotLag(slots: number): Verdict {
  return ladder(Math.max(0, slots), SLOT_LAG.good, SLOT_LAG.warn);
}

export interface IndexerBeat {
  subscription: string | null;
  lastLagSec: number | null;
  gapsOpen: number;
  failures: number;
}

/** Walk failures and open gaps are bad in and out of session; lag and the live subscription only count in session. */
export function gradeIndexer(beat: IndexerBeat, inSession: boolean): Verdict {
  if (beat.failures >= HEARTBEAT.failing || beat.gapsOpen > 0) return "bad";
  if (!inSession) return "good";
  const lag = beat.lastLagSec === null ? "good" : beat.lastLagSec < INDEXER_LAG_SEC.good ? "good" : beat.lastLagSec < INDEXER_LAG_SEC.warn ? "warn" : "bad";
  return worst(lag, beat.subscription === "connected" ? "good" : "warn");
}

export interface Beat {
  everyMs: number;
  startedMs: number;
  lastOkMs: number | null;
  failures: number;
}

/** Lag is the ops clock's now minus the last good pass (a beat that never passed counts from its start). */
export function gradeHeartbeat(beat: Beat, opsNowMs: number): { verdict: Verdict; lagSec: number } {
  const silentMs = opsNowMs - (beat.lastOkMs ?? beat.startedMs);
  const limitMs = Math.max(HEARTBEAT.silentMs, 3 * beat.everyMs);
  const verdict = beat.failures < HEARTBEAT.failing && silentMs <= limitMs ? "good" : "bad";
  return { verdict, lagSec: Math.max(0, Math.floor(silentMs / 1000)) };
}

export interface RelayEvidence {
  /** Windows voided for a missing print since the open, on lanes this source prints. */
  missingVoids: number;
  /** Slowest record lag over recent boundaries; null before the first print. */
  recentLagSec: number | null;
  /** Open lanes whose last boundary due (≥ 330 s ago) has no print yet. */
  behindLanes: number;
  /** The relay's missed-slot counter since it started. */
  missed: number;
}

export function gradeRelay(e: RelayEvidence): Verdict {
  if (e.missingVoids > 0) return "bad";
  const lag = e.recentLagSec === null ? "good" : ladder(e.recentLagSec, RELAY_RECORD_LAG_SEC.good, RELAY_RECORD_LAG_SEC.warn);
  return worst(lag, e.behindLanes > 0 || e.missed > 0 ? "warn" : "good");
}

/** The latest `cadenceSec`-aligned boundary at least `RELAY_DUE_AFTER_SEC` old (Windows are clock-aligned). */
export function dueBoundarySec(nowSec: number, cadenceSec: number): number {
  return Math.floor((nowSec - RELAY_DUE_AFTER_SEC) / cadenceSec) * cadenceSec;
}

/** `|p − c| × 1,000,000 / c` in integer centi-bps (spec §2 units); a zero check is maximal divergence. */
export function divergenceCentiBps(primaryE8: bigint, checkE8: bigint): bigint {
  const diff = primaryE8 >= checkE8 ? primaryE8 - checkE8 : checkE8 - primaryE8;
  if (checkE8 <= 0n) return diff === 0n ? 0n : CROSS_CHECK_CENTI_BPS.warn + 1n;
  return (diff * 1_000_000n) / checkE8;
}

/** Centi-bps shown to 2 dp without a float: 321n → "3.21". */
export function formatCentiBps(centiBps: bigint): string {
  return `${centiBps / 100n}.${(centiBps % 100n).toString().padStart(2, "0")}`;
}

export function gradeCrossCheck(maxCentiBps: bigint | null): Verdict {
  if (maxCentiBps === null) return "good";
  return maxCentiBps <= CROSS_CHECK_CENTI_BPS.good ? "good" : maxCentiBps <= CROSS_CHECK_CENTI_BPS.warn ? "warn" : "bad";
}

export interface ArchiveEvidence {
  maxFetchLagMs: number;
  minSigners: number;
  lateCount: number;
}

export function gradeArchive(e: ArchiveEvidence): Verdict {
  if (e.lateCount > 0 || e.minSigners < ARCHIVE.minSigners || e.maxFetchLagMs > ARCHIVE.warnFetchMs) return "bad";
  return e.maxFetchLagMs <= ARCHIVE.goodFetchMs && e.minSigners >= ARCHIVE.goodSigners ? "good" : "warn";
}

/** Both claims ready is good; ready but under the reserve plus one day's SOL budget warns; anything not ready is bad. */
export function gradeFaucet(solReady: boolean, tusdcReady: boolean, fundingLamports: bigint): Verdict {
  if (!solReady || !tusdcReady) return "bad";
  return fundingLamports >= SOL_FAUCET_POLICY.reserveLamports + SOL_FAUCET_POLICY.dailyLamports ? "good" : "warn";
}

export interface TrialSessions {
  ended: boolean;
  left: number;
  /** Ops lists only the next five sessions: every listed one is covered, so there may be more. */
  capped: boolean;
}

export function trialSessionsLeft(nowSec: number, lastCloseSec: number, upcoming: ReadonlyArray<{ closeSec: number }>): TrialSessions {
  if (nowSec > lastCloseSec) return { ended: true, left: 0, capped: false };
  const covered = upcoming.filter((s) => s.closeSec > nowSec && s.closeSec <= lastCloseSec);
  const last = upcoming.at(-1);
  return { ended: false, left: covered.length, capped: last !== undefined && covered.length === upcoming.length && last.closeSec < lastCloseSec };
}

export function gradeTrial(t: TrialSessions): Verdict {
  return t.ended || t.left > TRIAL_SESSIONS_WARN || t.capped ? "good" : "warn";
}

/** A roller lane state reduced to its kind: "open #22 13:30–13:35 v1" → "open"; "paused: no signed source" stays. */
export function laneKind(state: string): string {
  if (state.startsWith("open #")) return "open";
  if (state.startsWith("opening #")) return "opening";
  if (state.startsWith("open failed")) return "open failed";
  if (state.startsWith("paused: corporate action")) return "paused: corporate action";
  return state;
}

/** In session: no signed source is an honest pause; a lane waiting on a Book or failing to open warns; no calendar is bad. */
export function gradeLanes(states: readonly string[]): Verdict {
  const kinds = states.map(laneKind);
  if (kinds.length === 0 || kinds.some((k) => k === "closed: no calendar")) return "bad";
  return kinds.some((k) => k.startsWith("waiting:") || k === "open failed" || k.startsWith("closed")) ? "warn" : "good";
}
