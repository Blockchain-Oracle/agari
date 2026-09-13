import { BPS_DENOMINATOR } from "@masayume/core/constants";
import type { Quote, Side } from "@masayume/core/types";
import { bpsToOddsCents, mulBps, oneCent, priceRawToBps } from "@masayume/core/units";
import type { BinaryOrderQuote, BinaryStakeQuote } from "@somnia-chain/markets-sdk";

export interface QuoteParts {
  side: Side;
  stakeBase: bigint;
  stakeQuote: BinaryStakeQuote;
  orderQuote: BinaryOrderQuote;
  decimals: number;
  feeBps: number;
  quotedAtMs: number;
}

/**
 * Combines the SDK's two pure quote kernels: stake → lot-aligned size + protective limit + escrow,
 * then size → expected cost/average at today's book. Escrow is the cap a fill can never exceed.
 */
export function toQuote({ side, stakeBase, stakeQuote, orderQuote, decimals, feeBps, quotedAtMs }: QuoteParts): Quote {
  const avgPriceBps = priceRawToBps(orderQuote.avgPrice, decimals);
  const undeployed = stakeBase - stakeQuote.escrow;
  return {
    side,
    stakeBase,
    contractsRaw: stakeQuote.quantity,
    expectedCostBase: orderQuote.cost,
    maxCostBase: stakeQuote.escrow,
    limitPriceRaw: stakeQuote.yesPrice,
    avgPriceBps,
    oddsCents: bpsToOddsCents(avgPriceBps),
    payoutIfRightBase: mulBps(stakeQuote.quantity, BPS_DENOMINATOR - feeBps),
    fillableStakeBase: stakeQuote.escrow,
    partial: undeployed > oneCent(decimals),
    feeBps,
    decimals,
    quotedAtMs,
  };
}
