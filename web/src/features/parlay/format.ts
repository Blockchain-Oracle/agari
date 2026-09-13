import type { Diagnosis, MarketId } from "@masayume/core/types";
import { formatOracleRaw } from "@masayume/core/units";
import { ORACLE_SCALE } from "../markets/hero/units";

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** The ticket headline: `multiplier.toFixed(multiplier >= 10 ? 0 : 1)` in the reference, without a float. */
export function formatMultiplier(milli: number): string {
  if (milli >= 10_000) return `${Math.round(milli / 1000)}×`;
  const tenths = Math.round(milli / 100);
  return `${Math.floor(tenths / 10)}.${tenths % 10}×`;
}

/** The slip's `multiplier.toFixed(1)`. */
export function formatMultiplierTenths(milli: number): string {
  const tenths = Math.round(milli / 100);
  return `${Math.floor(tenths / 10)}.${tenths % 10}×`;
}

/** A probability per whole unit as `12.34` — the reference's `(p * 100).toFixed(2)`. */
export function formatProbPct(probRaw: bigint, one: bigint): string {
  const hundredths = Number((probRaw * 10_000n) / one);
  return `${Math.floor(hundredths / 100)}.${pad2(hundredths % 100)}`;
}

/** A per-leg probability in bps as `62%` — the reference's `(legProb * 100).toFixed(0)`. */
export function formatBpsPct(bps: number): string {
  return `${Math.round(bps / 100)}%`;
}

/** Whole dollars, grouped — the hero's own scale for a Window's line. */
export function formatLine(openingPriceRaw: bigint): string {
  return `$${formatOracleRaw(openingPriceRaw, ORACLE_SCALE, 0)}`;
}

/** The slip's `fmtUsd`: `$97.2k` above a thousand, whole dollars below. */
export function formatLineShort(openingPriceRaw: bigint): string {
  const whole = formatOracleRaw(openingPriceRaw, ORACLE_SCALE, 0).replace(/,/g, "");
  const dollars = Number(whole);
  if (dollars < 1000) return `$${whole}`;
  const tenthsOfK = Math.round(dollars / 100);
  return tenthsOfK % 10 === 0 ? `$${tenthsOfK / 10}k` : `$${Math.floor(tenthsOfK / 10)}.${tenthsOfK % 10}k`;
}

export function utilizationPct(bps: number): string {
  return String(Math.round(bps / 100));
}

export interface ThinBook {
  marketId: MarketId;
  filledRaw: bigint;
  depthRaw: bigint;
}

/**
 * `ThinBook(marketId, filled, depth)` as the reserve reverts it (`ParlayPricing.sol` L122) —
 * `diagnoseNamedRevert` prints the arguments into `technical`, so the leg and its two figures
 * can be named on the row instead of hidden in a tooltip.
 */
export function parseThinBook(diagnosis: Diagnosis | null): ThinBook | null {
  if (!diagnosis || diagnosis.errorName !== "ThinBook") return null;
  const match = /^ThinBook\((0x[0-9a-fA-F]+), (\d+), (\d+)\)$/.exec(diagnosis.technical);
  if (!match) return null;
  return { marketId: match[1] as MarketId, filledRaw: BigInt(match[2]!), depthRaw: BigInt(match[3]!) };
}
