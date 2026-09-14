/** A complete, valid `EventMarket` for tests (not exported from the package): a live 5m TSLA Regular Window. */
import type { EventMarket } from "../types/market";
import { testAddress, testMarketId } from "./ids";

export function testEventMarket(n: number, overrides: Partial<EventMarket> = {}): EventMarket {
  const marketId = testMarketId(n);
  return {
    marketId,
    venueId: testAddress(0xc0),
    asset: "TSLA",
    lane: "regular",
    question: "",
    intervalSec: 300,
    tradingStartSec: 1_800_000_000,
    lockAtSec: 1_800_000_300,
    expirySec: 1_800_000_300,
    poolAddress: testAddress(0xb0),
    marketAddress: marketId,
    seriesAddress: testAddress(0x5e),
    nonce: BigInt(n),
    policyVersion: 1,
    printSource: "redstone",
    collateral: testAddress(0xcc),
    decimals: 6,
    status: "Trading",
    winningOutcome: null,
    voided: false,
    voidReason: null,
    finalized: null,
    openingPriceRaw: 36_548_000_000n,
    volumeQuoteRaw: 0n,
    tradeCount: 0,
    lastPriceRaw: null,
    resolvedAtMs: null,
    ...overrides,
  };
}
