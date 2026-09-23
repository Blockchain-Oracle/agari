import { formatOracleRaw } from "@agari/core/units";
import { isBasketAsset, ORACLE_SCALE, POINTS_UNIT } from "@/features/markets/hero/units";

/** web's `oraclePriceText` (hero/OraclePrice.tsx, a DOM file): a print on the oracle scale, points for a basket. */
export function oraclePriceText(raw: bigint | null, asset = ""): string {
  if (raw === null) return "—";
  return isBasketAsset(asset) ? `${formatOracleRaw(raw, ORACLE_SCALE)} ${POINTS_UNIT}` : `$${formatOracleRaw(raw, ORACLE_SCALE)}`;
}
