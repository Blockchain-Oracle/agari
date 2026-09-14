/**
 * One complete, valid `EventMarket` for the `/dev` fixtures: a live Regular-lane TSLA Window with RedStone prints, on
 * fixture accounts. Fixtures override only what their screen is about, so a new field on the read model lands here once.
 */
import type { TickerSymbol } from "@agari/core/market";
import type { EventMarket, MarketId } from "@agari/core/types";
import { fixtureAddress } from "./fixture-ids";

export function fixtureWindow(input: { marketId: MarketId; asset?: TickerSymbol; intervalSec: number; expirySec: number; decimals: number } & Partial<EventMarket>): EventMarket {
  const { marketId, asset = "TSLA", intervalSec, expirySec, decimals, ...over } = input;
  return {
    marketId,
    venueId: null,
    asset,
    lane: "regular",
    question: "",
    intervalSec,
    tradingStartSec: expirySec - intervalSec,
    lockAtSec: expirySec,
    expirySec,
    poolAddress: fixtureAddress("0xb0"),
    marketAddress: marketId,
    seriesAddress: fixtureAddress("0x5e"),
    nonce: null,
    policyVersion: 1,
    printSource: "redstone",
    collateral: fixtureAddress("0xcc"),
    decimals,
    status: "Trading",
    winningOutcome: null,
    voided: false,
    voidReason: null,
    finalized: null,
    openingPriceRaw: null,
    volumeQuoteRaw: 0n,
    tradeCount: 0,
    lastPriceRaw: null,
    resolvedAtMs: null,
    ...over,
  };
}
