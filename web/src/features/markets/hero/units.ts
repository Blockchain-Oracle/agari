import type { AssetPrice, PricePoint } from "@agari/core/types";
import { oneUnit } from "@agari/core/units";
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
