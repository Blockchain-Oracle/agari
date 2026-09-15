import type { Refusal } from "./policy";

/**
 * Check 9 of tap-trading.md §3: per-signer and per-device hourly caps, the device and global daily lamport budgets and
 * the low-balance breaker, counted over the co-signs the sponsor actually issued (`sponsor_cosigns`). Days are UTC days,
 * as the tap caps' "resets 00:00 UTC". Fails closed: no device id, no co-sign.
 */
export interface CosignRow {
  /** The transaction signature: the sponsor's own, slot 0. */
  signature: string;
  signer: string;
  device: string;
  instruction: string;
  feeLamports: bigint;
  lastValidBlockHeight: bigint;
  createdAtMs: number;
}

export interface GateLimits {
  signerPerHour: number;
  devicePerHour: number;
  deviceDailyLamports: bigint;
  dailyLamports: bigint;
  minBalanceLamports: bigint;
}

export interface SponsorLedger {
  /** `local` = this process's counters (no `sponsor_cosigns` store); the GET says so. */
  readonly kind: "local" | "db";
  /** Checks every gate against the recorded rows and records `row` in the same step, or refuses and records nothing. */
  admit(row: CosignRow, limits: GateLimits, sponsorBalanceLamports: bigint): Promise<{ ok: true } | Refusal>;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const utcDay = (ms: number) => Math.floor(ms / DAY_MS);

export const breakerOpen = (balanceLamports: bigint, limits: Pick<GateLimits, "minBalanceLamports">) => balanceLamports < limits.minBalanceLamports;
export const NO_DEVICE: Refusal = { ok: false, status: 429, error: "no device id to gate on; the sponsor refuses rather than guess" };
export const BREAKER_REASON = "the sponsor's balance is below its floor; the key pays its own fee until it is topped up";

/** The gate verdict over `rows` (already recorded co-signs) for a new `row`; pure, so the store is interchangeable. */
export function gateVerdict(rows: readonly CosignRow[], row: CosignRow, limits: GateLimits, sponsorBalanceLamports: bigint): { ok: true } | Refusal {
  if (!row.device) return NO_DEVICE;
  if (breakerOpen(sponsorBalanceLamports, limits)) return { ok: false, status: 503, error: BREAKER_REASON };
  const hourAgo = row.createdAtMs - HOUR_MS;
  const today = utcDay(row.createdAtMs);
  let signerHour = 0;
  let deviceHour = 0;
  let deviceToday = 0n;
  let globalToday = 0n;
  for (const r of rows) {
    const recent = r.createdAtMs > hourAgo;
    if (recent && r.signer === row.signer) signerHour += 1;
    if (recent && r.device === row.device) deviceHour += 1;
    if (utcDay(r.createdAtMs) === today) {
      globalToday += r.feeLamports;
      if (r.device === row.device) deviceToday += r.feeLamports;
    }
  }
  if (signerHour >= limits.signerPerHour) return { ok: false, status: 429, error: `over the sponsor's ${limits.signerPerHour}-per-hour signer cap` };
  if (deviceHour >= limits.devicePerHour) return { ok: false, status: 429, error: `over the sponsor's ${limits.devicePerHour}-per-hour device cap` };
  if (deviceToday + row.feeLamports > limits.deviceDailyLamports) return { ok: false, status: 429, error: "this device has used today's sponsored fees (resets 00:00 UTC)" };
  if (globalToday + row.feeLamports > limits.dailyLamports) return { ok: false, status: 429, error: "the sponsor has spent today's budget (resets 00:00 UTC)" };
  return { ok: true };
}

/** In-process counters: check and record happen in one synchronous step, so concurrent requests can't both slip past a cap. */
export function createLocalLedger(): SponsorLedger & { rows(): readonly CosignRow[] } {
  let rows: CosignRow[] = [];
  return {
    kind: "local",
    rows: () => rows,
    async admit(row, limits, balance) {
      // Nothing older than yesterday can count towards an hour or today.
      rows = rows.filter((r) => r.createdAtMs > row.createdAtMs - DAY_MS - HOUR_MS);
      const verdict = gateVerdict(rows, row, limits, balance);
      if (verdict.ok) rows.push(row);
      return verdict;
    },
  };
}

/**
 * Attempts, before any RPC (the lead's S7 approval): every POST that names a device counts against that device and its
 * network address inside a sliding minute, whatever it turns out to be, so a well-formed request can't be replayed into
 * five RPC calls in a loop. A refused attempt isn't counted, so a paused client is back within the minute.
 */
export interface AttemptLimits {
  attemptsPerDevicePerMinute: number;
  attemptsPerIpPerMinute: number;
}

export interface AttemptLimiter {
  /** Counts the attempt and answers in one synchronous step. `ip` is the route's first `x-forwarded-for` hop, "" when absent. */
  admit(device: string, ip: string, nowMs: number, limits: AttemptLimits): { ok: true } | Refusal;
}

const MINUTE_MS = 60_000;
/** Above this many tracked keys, stale ones are swept so rotating device ids can't grow the map without bound. */
const SWEEP_AT_KEYS = 10_000;
/** Requests with no forwarded address share one bucket rather than skipping the limit. */
const NO_IP = "(no forwarded address)";

export function createAttemptLimiter(): AttemptLimiter {
  const seen = new Map<string, number[]>();
  const recent = (key: string, nowMs: number) => (seen.get(key) ?? []).filter((at) => nowMs - at < MINUTE_MS);
  return {
    admit(device, ip, nowMs, limits) {
      if (!device) return NO_DEVICE;
      if (seen.size > SWEEP_AT_KEYS) {
        for (const [key, times] of seen) if (times.every((at) => nowMs - at >= MINUTE_MS)) seen.delete(key);
      }
      const deviceKey = `device:${device}`;
      const ipKey = `ip:${ip || NO_IP}`;
      const byDevice = recent(deviceKey, nowMs);
      const byIp = recent(ipKey, nowMs);
      if (byDevice.length >= limits.attemptsPerDevicePerMinute) return { ok: false, status: 429, error: `over the sponsor's ${limits.attemptsPerDevicePerMinute}-per-minute device attempt limit` };
      if (byIp.length >= limits.attemptsPerIpPerMinute) return { ok: false, status: 429, error: `over the sponsor's ${limits.attemptsPerIpPerMinute}-per-minute network attempt limit` };
      seen.set(deviceKey, [...byDevice, nowMs]);
      seen.set(ipKey, [...byIp, nowMs]);
      return { ok: true };
    },
  };
}
