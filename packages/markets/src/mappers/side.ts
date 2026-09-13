import { SIDE_TO_OUTCOME, type OutcomeIdx, type Side } from "@masayume/core/types";
import type { quoteBinarySellOverBook, quoteBinaryStakeOverBook } from "@somnia-chain/markets-sdk";

export type BuySide = Parameters<typeof quoteBinaryStakeOverBook>[1];
export type SellSide = Parameters<typeof quoteBinarySellOverBook>[1];

export function toBuySide(side: Side): BuySide {
  return side === "up" ? "BUY_YES" : "BUY_NO";
}

export function toSellSide(side: Side): SellSide {
  return side === "up" ? "SELL_YES" : "SELL_NO";
}

export function outcomeIdxOf(side: Side): OutcomeIdx {
  return SIDE_TO_OUTCOME[side];
}

export function isBuy(side: string | null | undefined): boolean {
  return side === "BUY_YES" || side === "BUY_NO";
}
