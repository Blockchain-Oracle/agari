import { formatBaseUnits } from "@masayume/core/units";
import type { ReadoutCells } from "./ReadoutStrip";

/** Every bet kind reduced to the reference's three numbers. Structural types, so no reserve's module is imported for a string. */

const EMPTY: ReadoutCells = { cost: null, ret: null, loss: null };

export function plainCells(q: { expectedCostBase: bigint; payoutIfRightBase: bigint; maxCostBase: bigint } | null, decimals: number): ReadoutCells {
  if (!q) return EMPTY;
  return { cost: formatBaseUnits(q.expectedCostBase, decimals), ret: formatBaseUnits(q.payoutIfRightBase, decimals), loss: formatBaseUnits(q.maxCostBase, decimals) };
}

/** A boost: the stake is what the reserve charges and the most that can be lost; the return is what the owner collects if right. */
export function boostCells(q: { stakeBase: bigint; winIfRightBase: bigint } | null, decimals: number): ReadoutCells {
  if (!q) return EMPTY;
  return { cost: formatBaseUnits(q.stakeBase, decimals), ret: formatBaseUnits(q.winIfRightBase, decimals), loss: formatBaseUnits(q.stakeBase, decimals) };
}

/** The desk's sizing: contracts pay one unit each, so the quantity is the payout. */
export function privateCells(q: { costBase: bigint; quantityRaw: bigint } | null, decimals: number): ReadoutCells {
  if (!q) return EMPTY;
  return { cost: formatBaseUnits(q.costBase, decimals), ret: formatBaseUnits(q.quantityRaw, decimals), loss: formatBaseUnits(q.costBase, decimals) };
}

export function rangeCells(q: { stakeBase: bigint; maxPayoutBase: bigint } | null, decimals: number): ReadoutCells {
  if (!q) return EMPTY;
  return { cost: formatBaseUnits(q.stakeBase, decimals), ret: formatBaseUnits(q.maxPayoutBase, decimals, { maxDp: 0, minDp: 0 }), loss: formatBaseUnits(q.stakeBase, decimals) };
}
