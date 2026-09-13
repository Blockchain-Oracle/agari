import { toMarketId, type OpenPosition } from "@masayume/core/types";
import type { OpenPositionPnL } from "@somnia-chain/markets-sdk";
import { numberOf } from "./scalars";

export function toOpenPosition(p: OpenPositionPnL): OpenPosition {
  const expirySec = numberOf(p.market.expiry) ?? 0;
  return {
    marketId: toMarketId(p.market.id),
    asset: p.market.asset,
    intervalSec: numberOf(p.market.intervalSec) ?? 0,
    expirySec,
    decimals: p.market.quoteDecimals,
    balanceUpRaw: p.balanceYes,
    balanceDownRaw: p.balanceNo,
    costBasisBase: p.costBasis,
    avgCostRaw: p.avgCost,
    markValueBase: p.markValue,
    unrealizedPnlBase: p.unrealizedPnl,
    realizedPnlBase: p.realizedPnl,
  };
}
