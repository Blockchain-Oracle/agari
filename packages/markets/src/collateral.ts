import { ok, type Reading } from "@agari/core/schemas";
import type { Address } from "@agari/core/types";
import { nowMs } from "./provider/clock";
import { notDeployedReading } from "./stub/not-deployed";

export interface CollateralInfo {
  address: Address;
  decimals: number;
  symbol: string;
}

let cached: CollateralInfo | null = null;

/** The tUSDC mint and its decimals, read once from chain and never guessed. The mint is created by S2's `init-events`. */
export async function loadCollateral(): Promise<Reading<CollateralInfo>> {
  if (cached) return ok(cached, nowMs());
  return notDeployedReading("the tUSDC collateral mint does not exist until agari-events is initialised (S1 stub)");
}

export function getCollateral(): CollateralInfo {
  if (!cached) throw new Error("collateral not loaded — await loadCollateral() during boot");
  return cached;
}

export function collateralOrNull(): CollateralInfo | null {
  return cached;
}
