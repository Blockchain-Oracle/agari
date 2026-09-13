import { oneUnit } from "@masayume/core/units";
import { ORACLE_PRICE_SCALE } from "@masayume/markets/identity";

/** Sensei's snapshot uses whole dollars; chart samples and opening prints arrive in oracle cents. */
export function oracleToWholeUsd(raw: bigint | null): number | null {
  return raw === null ? null : Math.round(Number(raw) / Number(oneUnit(ORACLE_PRICE_SCALE)));
}
