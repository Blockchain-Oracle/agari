/**
 * Every read behind the `MarketsProvider` port, in one place for the hooks and the submitter (first-call.md §2.2).
 * Sources: chain for anything that gates a write or must be head-fresh, the indexer for lists and history, ops for
 * spot. The Trading Balance reads are agari-vault's (`vault/read.ts`, S7): no deployment → `null` and zeros. There is no
 * settlement fee.
 */
import { ok, type Reading } from "@agari/core/schemas";
import type { MarketId } from "@agari/core/types";
import { nowMs } from "./clock";

export { freshQuoteStake, getBookDepth, getBookParams } from "./books";
export { readRecoveryCursor, syncClock } from "./clock-sync";
export { listWalletFills, listWalletHistory, type WalletFillsQuery } from "./history";
export { getMarket, getMarketsLite, getResolution, laneNextStart, listLiveLanes, listSettled, nextWindow } from "./markets";
export { getHoldings, getOnchain, getOpeningPrice } from "./onchain";
export { getArchiveSeries, getAssetPrice, getPriceHistory } from "./prices";
export { getBalanceSheet, getWalletCollateral, listClaimables, listOpenPositions } from "./wallet";
export { getVaultHoldings, getVaultSnapshot } from "../vault/read";

/** The engine has no settlement fee: redeem pays `⌊amount × numerator / 10⁷⌋` (D-012, core `estPayoutBase`). */
export async function settlementFeeBps(_marketId: MarketId): Promise<Reading<number>> {
  return ok(0, nowMs());
}
