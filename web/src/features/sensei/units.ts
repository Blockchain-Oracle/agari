import { oneUnit } from "@agari/core/units";
import { ORACLE_PRICE_SCALE } from "@agari/markets/identity";

/** Sensei's snapshot uses whole dollars; chart samples and opening prints arrive at the print scale (10⁻⁸, D-011). */
export function oracleToWholeUsd(raw: bigint | null): number | null {
  return raw === null ? null : Math.round(Number(raw) / Number(oneUnit(ORACLE_PRICE_SCALE)));
}
