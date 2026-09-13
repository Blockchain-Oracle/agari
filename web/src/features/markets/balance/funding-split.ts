import type { Address, BalanceSheet } from "@masayume/core/types";

export interface FundingSplit {
  creditUsedBase: bigint;
  walletUsedBase: bigint;
  /** Cost left uncovered once pool credit and spendable collateral are both exhausted. */
  shortfallBase: bigint;
}

const min = (a: bigint, b: bigint): bigint => (a < b ? a : b);

/** Venue payout credit lives per pool; only the credit sitting on the window's own pool is drawn for that window. */
export function creditForPool(sheet: Pick<BalanceSheet, "venueCreditByPool">, pool: Address): bigint {
  const wanted = pool.toLowerCase();
  return sheet.venueCreditByPool
    .filter((credit) => credit.pool.toLowerCase() === wanted)
    .reduce((sum, credit) => sum + credit.amountBase, 0n);
}

/** The venue draws pool credit before wallet collateral (FR-5); the Ticket's funding note states this split. */
export function fundingSplit(costBase: bigint, spendableBase: bigint, creditBase: bigint): FundingSplit {
  const creditUsedBase = min(costBase, creditBase);
  const remaining = costBase - creditUsedBase;
  const walletUsedBase = min(remaining, spendableBase);
  return { creditUsedBase, walletUsedBase, shortfallBase: remaining - walletUsedBase };
}
