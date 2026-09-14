/**
 * Every read behind the `MarketsProvider` port, in one place for the hooks and the submitter (first-call.md §2.2).
 * Sources: chain for anything that gates a write or must be head-fresh, the indexer for lists and history, ops for
 * spot. Reads with no Solana meaning keep Masayume's honest shapes: no vault → `null` and zeros; no settlement fee.
 */
import { ok, type Reading } from "@agari/core/schemas";
import type { Address, MarketId, OnchainSnapshot } from "@agari/core/types";
import type { VaultHoldings, VaultSnapshot } from "@agari/core/vault";
import { nowMs } from "./clock";

export { freshQuoteStake, getBookDepth, getBookParams } from "./books";
export { readRecoveryCursor, syncClock } from "./clock-sync";
export { listWalletFills, listWalletHistory, type WalletFillsQuery } from "./history";
export { getMarket, getMarketsLite, getResolution, laneNextStart, listLiveLanes, listSettled, nextWindow } from "./markets";
export { getHoldings, getOnchain, getOpeningPrice } from "./onchain";
export { getAssetPrice, getPriceHistory } from "./prices";
export { getBalanceSheet, getWalletCollateral, listClaimables, listOpenPositions } from "./wallet";

/** The engine has no settlement fee: redeem pays `⌊amount × numerator / 10⁷⌋` (D-012, core `estPayoutBase`). */
export async function settlementFeeBps(_marketId: MarketId): Promise<Reading<number>> {
  return ok(0, nowMs());
}

/** No EventVault on this cluster yet (S7): the port's honest `null`. */
export async function getVaultSnapshot(_wallet: Address): Promise<Reading<VaultSnapshot | null>> {
  return ok(null, nowMs());
}

/** No EventVault on this cluster yet (S7): zeros, never an error. */
export async function getVaultHoldings(_wallet: Address, onchain: OnchainSnapshot): Promise<Reading<VaultHoldings>> {
  return ok({ marketId: onchain.marketId, upRaw: 0n, downRaw: 0n, upGrantId: 0n, downGrantId: 0n }, nowMs());
}
