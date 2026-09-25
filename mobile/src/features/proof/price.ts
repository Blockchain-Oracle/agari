import { formatOracleRaw } from "@agari/core/units";
import { isBasketAsset, ORACLE_SCALE, POINTS_UNIT } from "@/features/markets/hero/units";

/** web's `oraclePriceText` (markets/hero/OraclePrice.tsx): dollars, or points for a basket; "—" when unknown. */
export function oraclePriceText(raw: bigint | null, asset = ""): string {
  if (raw === null) return "—";
  return isBasketAsset(asset) ? `${formatOracleRaw(raw, ORACLE_SCALE)} ${POINTS_UNIT}` : `$${formatOracleRaw(raw, ORACLE_SCALE)}`;
}
