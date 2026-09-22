/**
 * What the market looks like for one candidate, right now (desk.md §8). Pure: the ops runner reads the sources and
 * fills this in; core only defines the shape and the arithmetic over it. Three prices, kept apart on purpose:
 *
 *   spot      the venue-attested PreStocks token price this instant: the reference the PROGRAM measures its 8 % band
 *             and the premium against (`DeskRef.token_price_e8`)
 *   mean      the 30-minute mean of the same reads: what holdings are valued on, and what "moving fast" is measured on
 *   mark      PreStocks' own valuation per token (`markPrice`); the premium is spot against mark: "above its mark"
 *   index     Pyth's `Equity.Index.<NAME>/USD` valuation, when the venue is entitled to it (D-125); null otherwise
 *
 * What the trade itself costs is measured separately, for its exact size, so a fee is never mistaken for a discount.
 */
import type { PreIpoSymbol } from "../market/tickers";
import type { DeskSide } from "./needs";
import { absBigint, bpsBetween, VALUE_SCALE } from "./units";

/** Under this, the spot is "in line" with its own half-hour mean and the gap is treated as noise. */
export const IN_LINE_BPS = 50;
/** The spot this instant against its own 30-minute mean. Beyond this, someone is pushing the price. */
export const MOVING_FAST_BPS = 100;
/** The program refuses a reference older than this (desk.md §4.5 step 7). */
export const REFERENCE_MAX_AGE_SEC = 900;
/** The most accounts a Jupiter route may carry inside the desk's transaction (plan §8 C3: `maxAccounts 20`). */
export const MAX_ROUTE_ACCOUNTS = 20;

export interface DeskMarketRead {
  atSec: number;
  symbol: PreIpoSymbol;
  spotE8: bigint;
  meanE8: bigint;
  markE8: bigint | null;
  indexE8: bigint | null;
  multiplierE12: bigint;
  /** How old the venue's latest read of this name is, in seconds; null when there is none. */
  referenceAgeSec: number | null;
  /** Spot against its mean, signed. Negative means the spot is below the half-hour mean. */
  gapBps: number;
  inLine: boolean;
  /** `|gapBps|`. */
  movingBps: number;
  /** Spot against the mark ("above its mark"), signed; null without a mark. */
  premiumBps: number | null;
  /** Spot against Pyth's index, when entitled; null otherwise. */
  indexPremiumBps: number | null;
  /** A real executable quote for the candidate's exact size; null when Jupiter had none. */
  quoteOut: bigint | null;
  /** What THIS trade costs against the spot: fees plus what its own size moves the price. Never negative. Null without a quote. */
  costBps: number | null;
  /** How many accounts the quoted route needs (the transaction carries at most `MAX_ROUTE_ACCOUNTS`). */
  routeAccounts: number | null;
  /** Token-2022 flags; null means the read failed and the desk must not assume. */
  mintPaused: boolean | null;
  accountFrozen: boolean | null;
}

/** The price one leg executes at, per UI token × 10^8: `usdc × 10^23 / (raw × multiplier)`. */
export function executionPriceE8(usdcE6: bigint, raw: bigint, multiplierE12: bigint): bigint {
  if (raw <= 0n || multiplierE12 <= 0n) return 0n;
  return (usdcE6 * VALUE_SCALE) / (raw * multiplierE12);
}

/** What a trade of this size costs against the spot, in basis points; never negative. */
export function costBpsFor(side: DeskSide, amountIn: bigint, quoteOut: bigint, spotE8: bigint, multiplierE12: bigint): number {
  const execution = side === "buy" ? executionPriceE8(amountIn, quoteOut, multiplierE12) : executionPriceE8(quoteOut, amountIn, multiplierE12);
  if (execution <= 0n || spotE8 <= 0n) return 0;
  const against = side === "buy" ? bpsBetween(execution, spotE8) : bpsBetween(spotE8, execution);
  return Math.max(against, 0);
}

/** The gap, moving and in-line figures from the two prices. */
export function gapOf(spotE8: bigint, meanE8: bigint): { gapBps: number; movingBps: number; inLine: boolean } {
  const gapBps = bpsBetween(spotE8, meanE8);
  return { gapBps, movingBps: Number(absBigint(BigInt(gapBps))), inLine: Math.abs(gapBps) < IN_LINE_BPS };
}

/** Which reference the premium ceiling is measured against, and the figure: Pyth's index when the owner requires it. */
export function premiumReference(m: Pick<DeskMarketRead, "markE8" | "indexE8">, requirePythIndex: boolean): { source: "mark" | "index"; referenceE8: bigint | null } {
  if (requirePythIndex) return { source: "index", referenceE8: m.indexE8 };
  return { source: "mark", referenceE8: m.markE8 };
}
