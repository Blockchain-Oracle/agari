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
