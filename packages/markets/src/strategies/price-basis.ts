import { oneUnit } from "@agari/core/units";
import { ORACLE_PRICE_SCALE } from "../identity";

/**
 * Opening prints are normalized to 8 dp on-chain (`PRINT_EXPO`); the spot feed carries its own scale.
 * Strategy arithmetic and prompt formatting require both to share the feed's scale. Keep the
 * provider's print units unchanged because the market UI and settlement readers expect them.
 */
export function openingOnFeedScale(oracleRaw: bigint, feedDecimals: number): bigint {
  if (oracleRaw <= 0n || !Number.isSafeInteger(feedDecimals) || feedDecimals < ORACLE_PRICE_SCALE || feedDecimals > 36) {
    throw new Error("Opening print and price-feed units could not be reconciled; holding");
  }
  return oracleRaw * oneUnit(feedDecimals - ORACLE_PRICE_SCALE);
}
