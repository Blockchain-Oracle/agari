import type { Address, MarketId } from "@masayume/core/types";
import type { QueryClient } from "@tanstack/react-query";
import { keys } from "./keys";

export interface WriteScope {
  wallet: Address;
  marketId?: MarketId;
}

/** After a confirmed write every read it can change is refetched; the live book is push-fed and needs nothing. */
export async function invalidateAfterWrite(queryClient: QueryClient, { wallet, marketId }: WriteScope): Promise<void> {
  // Dropping the trailing venue id turns the key into a prefix that matches every venue for this wallet.
  const claimablesForWallet = keys.claimables(wallet, null).slice(0, -1);
  const families = [
    keys.balanceSheet(wallet),
    keys.walletCollateral(wallet),
    keys.vault(wallet),
    keys.positions(wallet),
    keys.history(wallet),
    keys.parlays(wallet),
    keys.parlayReserve(),
    keys.ranges(wallet),
    keys.rangeReserve(),
    keys.makerVault(),
    keys.makerShares(wallet),
    keys.leveragePositions(wallet),
    keys.leverageReserve(),
    keys.privateDesk(),
    keys.privateBudget(wallet),
    claimablesForWallet,
    ...(marketId ? [keys.onchain(marketId), keys.market(marketId)] : []),
  ];
  await Promise.all(families.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
