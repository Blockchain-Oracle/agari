/**
 * One complete, valid `EventMarket` for the `/dev` fixtures: a live Regular-lane TSLA Window with RedStone prints, on
 * fixture accounts. Fixtures override only what their screen is about, so a new field on the read model lands here once.
 * A `lane` and `lockAtSec` pass straight through; `fixtureGapWindow` builds a Gap from its three instants (S6 §5).
 */
import type { TickerSymbol } from "@agari/core/market";
import { GAP_CADENCE_SEC, type EventMarket, type LaneBasis, type MarketId } from "@agari/core/types";
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

/** The real 09-18 Gap (D-054): calls open Fri 20:00Z (16:00 ET), lock Mon 00:00Z (Sun 20:00 ET), settle Mon 13:30Z (09:30 ET). */
export const GAP_0918 = { tradingStartSec: 1_789_761_600, lockAtSec: 1_789_948_800, expirySec: 1_789_997_400 } as const;

/** A Gap Window: its span is the weekend (holidays stretch it), its cadence seed is a week, and it locks before it expires. */
export function fixtureGapWindow(input: { marketId: MarketId; asset?: TickerSymbol; decimals: number; span?: { tradingStartSec: number; lockAtSec: number; expirySec: number } } & Partial<EventMarket>): EventMarket {
  const { span = GAP_0918, ...rest } = input;
  return fixtureWindow({ ...rest, lane: "gap" satisfies LaneBasis, intervalSec: GAP_CADENCE_SEC, ...span, printSource: rest.printSource ?? "pyth" });
}
