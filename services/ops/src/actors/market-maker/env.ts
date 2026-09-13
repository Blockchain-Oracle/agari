import type { Hex } from "@masayume/core/types";

export interface MakerEnv {
  privateKey: Hex | null;
  /** Half the spread the actor asks for around the fair, per whole unit of collateral (raw). */
  halfSpreadRaw: bigint;
  /** Contracts a side per quote, whole units. */
  quoteSize: number;
  refreshMs: number;
  /** A quote's own life: it expires on the venue this long after it was placed, dead actor or not. */
  quoteTtlSec: number;
  /** Requote only when the fair has moved at least this many ticks since the pair was placed. */
  requoteTicks: number;
  assets: string[];
  intervals: number[];
  dryRun: boolean;
  venueId: string | undefined;
}

const DEFAULT_REFRESH_MS = 45_000;
const DEFAULT_HALF_SPREAD_RAW = 15_000n;
const DEFAULT_QUOTE_SIZE = 5;
const DEFAULT_TTL_SEC = 180;
const DEFAULT_REQUOTE_TICKS = 3;
const DEFAULT_INTERVALS = [300, 900, 3600];

const list = (raw: string | undefined) => (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/** Read once at boot; a missing key means scan-and-report, never a guessed signer. Dry run unless told otherwise. */
export function readMakerEnv(env: NodeJS.ProcessEnv = process.env): MakerEnv {
  const key = env.MAKER_PRIVATE_KEY;
  const half = env.MM_HALF_SPREAD_RAW ? BigInt(env.MM_HALF_SPREAD_RAW) : DEFAULT_HALF_SPREAD_RAW;
  const size = Number(env.MM_QUOTE_SIZE);
  const refresh = Number(env.MM_REFRESH_MS);
  const ttl = Number(env.MM_QUOTE_TTL_SEC);
  const ticks = Number(env.MM_REQUOTE_TICKS);
  const intervals = list(env.MM_INTERVALS).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  return {
    privateKey: key && /^0x[0-9a-fA-F]{64}$/.test(key) ? (key as Hex) : null,
    halfSpreadRaw: half > 0n ? half : DEFAULT_HALF_SPREAD_RAW,
    quoteSize: Number.isFinite(size) && size > 0 ? size : DEFAULT_QUOTE_SIZE,
    refreshMs: Number.isFinite(refresh) && refresh >= 10_000 ? refresh : DEFAULT_REFRESH_MS,
    quoteTtlSec: Number.isFinite(ttl) && ttl >= 30 ? ttl : DEFAULT_TTL_SEC,
    requoteTicks: Number.isFinite(ticks) && ticks >= 1 ? ticks : DEFAULT_REQUOTE_TICKS,
    assets: list(env.MM_ASSETS).map((a) => a.toUpperCase()),
    intervals: intervals.length > 0 ? intervals : DEFAULT_INTERVALS,
    dryRun: !(env.DRY_RUN === "0" || env.DRY_RUN === "false"),
    venueId: env.VENUE_ID,
  };
}
