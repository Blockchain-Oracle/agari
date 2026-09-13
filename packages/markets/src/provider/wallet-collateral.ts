import type { Address } from "@masayume/core/types";
import { loadCollateral } from "../collateral";
import { getClient } from "../runtime/read-runtime";
import { withReading } from "./reading";

/** A wallet's token balance does not depend on portfolio, venue discovery, or vault reads. */
export function getWalletCollateral(wallet: Address) {
  return withReading(`wallet-collateral:${wallet}`, async (inner) => {
    const collateral = inner(await loadCollateral());
    const amountBase = await getClient().getErc20Balance(collateral.address, wallet);
    return { amountBase, decimals: collateral.decimals, symbol: collateral.symbol };
  });
}
