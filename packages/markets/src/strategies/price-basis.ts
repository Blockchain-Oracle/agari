import { oneUnit } from "@masayume/core/units";
import { ORACLE_PRICE_SCALE } from "../identity";

/**
 * Oracle opening prints are cents (2 dp); the price feed carries its own scale (currently 18 dp).
 * Strategy arithmetic and prompt formatting require both to share the feed's scale. Keep the
 * provider's oracle units unchanged because the market UI and settlement readers expect cents.
 */
export function openingOnFeedScale(oracleRaw: bigint, feedDecimals: number): bigint {
  if (oracleRaw <= 0n || !Number.isSafeInteger(feedDecimals) || feedDecimals < ORACLE_PRICE_SCALE || feedDecimals > 36) {
    throw new Error("Opening print and price-feed units could not be reconciled; holding");
  }
  return oracleRaw * oneUnit(feedDecimals - ORACLE_PRICE_SCALE);
}
