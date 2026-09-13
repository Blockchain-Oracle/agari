import type { BookedOrder } from "@agari/core/ports";
import type { MarketId, Side } from "@agari/core/types";
import { ceilDiv, oneUnit, ownTermsPriceRaw, priceRawToBps } from "@agari/core/units";
import type { PlaceOrderResult } from "@somnia-chain/markets-sdk";

export interface BookFillsInput {
  result: PlaceOrderResult;
  marketId: MarketId;
  side: Side;
  decimals: number;
}

/** What was bought is what the receipt's fills say — never the requested size (FR-9). Null when nothing crossed. */
export function bookFills({ result, marketId, side, decimals }: BookFillsInput): BookedOrder | null {
  const one = oneUnit(decimals);
  let contractsRaw = 0n;
  let costBase = 0n;
  for (const fill of result.fills) {
    contractsRaw += fill.quantityFilled;
    // Fill prices are quoted in UP terms; a DOWN buyer pays the complement (canon #20).
    costBase += ceilDiv(fill.quantityFilled * ownTermsPriceRaw(fill.fillPrice, side, decimals), one);
  }
  if (contractsRaw === 0n) return null;
  return {
    marketId,
    side,
    contractsRaw,
    costBase,
    avgPriceBps: priceRawToBps((costBase * one) / contractsRaw, decimals),
    txHash: result.hash,
    fillCount: result.fills.length,
  };
}
