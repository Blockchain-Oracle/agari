import type { BalanceSheet, MarketId } from "@agari/core/types";

export interface FundingSplit {
  creditUsedBase: bigint;
  walletUsedBase: bigint;
  /** Cost left uncovered once pool credit and spendable collateral are both exhausted. */
  shortfallBase: bigint;
}

const min = (a: bigint, b: bigint): bigint => (a < b ? a : b);

/**
 * Venue payout credit lives in each Window's Ledger seat; only the credit sitting in that Window is drawn for it.
 * Matched exactly: a MarketId is base58 and case-sensitive (D-010).
 */
export function creditForMarket(sheet: Pick<BalanceSheet, "venueCreditByMarket">, marketId: MarketId): bigint {
  return sheet.venueCreditByMarket
    .filter((credit) => credit.marketId === marketId)
    .reduce((sum, credit) => sum + credit.amountBase, 0n);
}

/** The venue draws pool credit before wallet collateral (FR-5); the Ticket's funding note states this split. */
export function fundingSplit(costBase: bigint, spendableBase: bigint, creditBase: bigint): FundingSplit {
  const creditUsedBase = min(costBase, creditBase);
  const remaining = costBase - creditUsedBase;
  const walletUsedBase = min(remaining, spendableBase);
  return { creditUsedBase, walletUsedBase, shortfallBase: remaining - walletUsedBase };
}
