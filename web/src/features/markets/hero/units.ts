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
