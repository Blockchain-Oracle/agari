import { ok, type Reading } from "@agari/core/schemas";
import type { Address } from "@agari/core/types";
import { nowMs } from "./provider/clock";
import { withReading } from "./provider/reading";
import { readVenueStatic } from "./runtime/accounts";

export interface CollateralInfo {
  address: Address;
  decimals: number;
  symbol: string;
}

/** Test collateral's display name (D-026); the mint address and decimals always come from chain. */
const COLLATERAL_SYMBOL = "tUSDC";

let cached: CollateralInfo | null = null;

/**
 * The collateral mint and its decimals, read once from `GlobalConfig` and never guessed. The config stores the mint's
 * decimals at init (`collateral_decimals`, copied from the mint, which can't change them), so one account read
 * serves the venue facts and this.
 */
export async function loadCollateral(): Promise<Reading<CollateralInfo>> {
  if (cached) return ok(cached, nowMs());
  return withReading("collateral", async () => {
    const venue = await readVenueStatic();
    cached = { address: venue.collateralMint as string as Address, decimals: venue.decimals, symbol: COLLATERAL_SYMBOL };
    return cached;
  });
}

export function getCollateral(): CollateralInfo {
  if (!cached) throw new Error("collateral not loaded — await loadCollateral() during boot");
  return cached;
}

export function collateralOrNull(): CollateralInfo | null {
  return cached;
}
