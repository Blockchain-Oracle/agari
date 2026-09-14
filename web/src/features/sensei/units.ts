import { oneUnit } from "@agari/core/units";
import { ORACLE_PRICE_SCALE } from "@agari/markets/identity";

const WHOLE_DOLLARS_FROM = 1_000n;
const CENTS_DP = 2;

/**
 * A print (10⁻⁸, D-011) as the dollars Sensei's snapshot carries, on the app's headline rule (lane 4d's `usdLine`):
 * whole dollars from $1,000 up, as Masayume read BTC and ETH, and cents below, where a stock's whole Window can move
 * less than a dollar and whole dollars would tell the model the price sits on its line.
 */
export function oracleToUsd(raw: bigint | null): number | null {
  if (raw === null) return null;
  const unit = oneUnit(ORACLE_PRICE_SCALE);
  if (raw >= WHOLE_DOLLARS_FROM * unit) return Math.round(Number(raw) / Number(unit));
  const centUnit = oneUnit(ORACLE_PRICE_SCALE - CENTS_DP);
  return Number((raw + centUnit / 2n) / centUnit) / 100;
}

