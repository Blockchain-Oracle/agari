import { ok, type Reading } from "@masayume/core/schemas";
import type { Address } from "@masayume/core/types";
import { resolveAddresses } from "./addresses";
import { getClient } from "./runtime/read-runtime";
import { nowMs } from "./provider/clock";
import { withReading } from "./provider/reading";

export interface CollateralInfo {
  address: Address;
  decimals: number;
  symbol: string;
}

let cached: CollateralInfo | null = null;

/** Token decimals come from chain exactly once — testnet tUSDC is 6 dp, mainnet USDso is 18 dp, and nothing reverts if you guess wrong (AD-2). */
export async function loadCollateral(): Promise<Reading<CollateralInfo>> {
  if (cached) return ok(cached, nowMs());
  return withReading("collateral", async () => {
    const address = resolveAddresses().collateral;
    if (!address) throw new Error("collateral address is not configured for this deployment");
    const meta = await getClient().getErc20Metadata(address);
    cached = { address, decimals: meta.decimals, symbol: meta.symbol };
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
