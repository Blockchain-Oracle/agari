import { isBasketSymbol } from "@agari/core/market";
import type { AssetPrice, PricePoint } from "@agari/core/types";
import { formatOracleRaw, oneUnit } from "@agari/core/units";
import { ORACLE_PRICE_SCALE, PRICE_BASIS } from "@agari/markets/identity";

/** Spot ticks carry their own `decimals`; this default is the print scale (prints are normalized to 10⁻⁸ on-chain). */
export const FEED_DECIMALS_DEFAULT = 8;
export const ORACLE_SCALE = ORACLE_PRICE_SCALE;

/** The series a Window settles on. Shared so the chart, the hero and the reel can never quote different numbers. */
export function basisRaw(point: Pick<PricePoint | AssetPrice, "priceRaw" | "emaRaw">): bigint {
  return PRICE_BASIS === "ema" ? point.emaRaw : point.priceRaw;
}

/** Feed raw (10^feedDecimals) → the print scale (10^ORACLE_SCALE), truncating precision a print never carries. */
export function feedRawToOracleRaw(raw: bigint, feedDecimals = FEED_DECIMALS_DEFAULT): bigint {
  const shift = feedDecimals - ORACLE_SCALE;
  return shift >= 0 ? raw / oneUnit(shift) : raw * oneUnit(-shift);
}

/** Masayume drew every price on the oracle's cents scale (its ORACLE_SCALE was 2); prints here carry 10⁻⁸, and cents is still the display. */
export const PRICE_DISPLAY_DP = 2;

/**
 * Whole dollars only from $10,000 up. The reference drew whole dollars from $1,000, which suited BTC and ETH; here a
 * pre-IPO name trades above $1,000 (OPENAI near $1,130) and its Window settles to the cent, so "above $1,132" for a
 * line of $1,132.74 showed a question the chain does not ask. Nothing listed trades at $10,000, so every listed price
 * and line carries its cents; the same threshold as the range ticket's band edges (`range/format.ts`).
 */
export const WHOLE_DOLLARS_FROM = 10_000n;

/**
 * A dollar level or move: cents below `WHOLE_DOLLARS_FROM`, where a stock's whole Window can move less than a
 * dollar, whole dollars from there up (the reference's `usd0`). A move takes its line's scale (`levelRaw`), so
 * "$251.37" is never followed by "+$0".
 */
export function usdLine(raw: bigint, levelRaw: bigint = raw): string {
  const dp = levelRaw >= WHOLE_DOLLARS_FROM * oneUnit(ORACLE_SCALE) ? 0 : PRICE_DISPLAY_DP;
  return `$${formatOracleRaw(raw, ORACLE_SCALE, dp)}`;
}

/**
 * A basket (S19, D-124) is quoted in points, never dollars: its Window prints an equal-weight index at base 1,000
 * (`1e11` at the print scale), so "$1,004.20" would name a price nobody can pay. Two decimals always: a basket's whole
 * Window can move a fraction of a point.
 */
export const POINTS_UNIT = "pts";
export const isBasketAsset = (asset: string): boolean => isBasketSymbol(asset);

/** "1,004.20 pts": an index level or a move in points. */
export function pointsLine(raw: bigint): string {
  return `${formatOracleRaw(raw, ORACLE_SCALE, PRICE_DISPLAY_DP)} ${POINTS_UNIT}`;
}

/**
 * The one price formatter for a surface that knows its asset: points for a basket, dollars (`usdLine`) for anything
 * else. Every call site with an asset in scope goes through here, so a basket can never be shown as dollars.
 */
export function assetPriceLine(asset: string, raw: bigint, levelRaw: bigint = raw): string {
  return isBasketAsset(asset) ? pointsLine(raw) : usdLine(raw, levelRaw);
}

/** Two decimals whatever the level (the reel's live spot, the reference's `usd2`), in the asset's unit. */
export function assetSpotLine(asset: string, raw: bigint): string {
  return isBasketAsset(asset) ? pointsLine(raw) : `$${formatOracleRaw(raw, ORACLE_SCALE, PRICE_DISPLAY_DP)}`;
}

/** The sign a figure carries before it ("$", or nothing for points) and the figure without it, for a slot that sets them apart. */
export function assetPriceParts(asset: string, raw: bigint): { sign: string; figure: string } {
  const line = assetPriceLine(asset, raw);
  return line.startsWith("$") ? { sign: "$", figure: line.slice(1) } : { sign: "", figure: line };
}

/** What the headline pairs the asset with before a line exists: "TSLA · USD", "AILABS · index". */
export const assetPairUnit = (asset: string): "USD" | "index" => (isBasketAsset(asset) ? "index" : "USD");
