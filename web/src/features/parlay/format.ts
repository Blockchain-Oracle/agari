import { isMarketId, type Diagnosis, type MarketId } from "@agari/core/types";
import { formatOracleRaw } from "@agari/core/units";
import { assetPriceLine, isBasketAsset, ORACLE_SCALE } from "../markets/hero/units";

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

/** The hero's own scale for a Window's line: dollars to the cent, or points for a basket (S19). */
export function formatLine(openingPriceRaw: bigint, asset = ""): string {
  return assetPriceLine(asset, openingPriceRaw);
}

/** The slip's `fmtUsd`: `$97.2k` above a thousand, the line in cents below (a stock's Window moves in cents). */
export function formatLineShort(openingPriceRaw: bigint, asset = ""): string {
  if (isBasketAsset(asset)) return assetPriceLine(asset, openingPriceRaw);
  const whole = formatOracleRaw(openingPriceRaw, ORACLE_SCALE, 0).replace(/,/g, "");
  const dollars = Number(whole);
  if (dollars < 1000) return assetPriceLine(asset, openingPriceRaw);
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
 * `ThinBook(marketId, filled, depth)` as the reserve refuses it (Masayume `ParlayPricing.sol` L122; `agari-parlay` in S10, base58 id) —
 * `diagnoseNamedRevert` prints the arguments into `technical`, so the leg and its two figures
 * can be named on the row instead of hidden in a tooltip.
 */
export function parseThinBook(diagnosis: Diagnosis | null): ThinBook | null {
  if (!diagnosis || diagnosis.errorName !== "ThinBook") return null;
  const match = /^ThinBook\(([1-9A-HJ-NP-Za-km-z]{32,44}), (\d+), (\d+)\)$/.exec(diagnosis.technical);
  if (!match || !isMarketId(match[1])) return null;
  return { marketId: match[1], filledRaw: BigInt(match[2]!), depthRaw: BigInt(match[3]!) };
}
