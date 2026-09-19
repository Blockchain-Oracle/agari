/**
 * The card's "See an example" (plan Step 2): sample holdings through the real `pickHedge`, on a sample 24/7 OpenAI
 * Window that is always mid-flight at the moment it is asked for. Stamped in the UI as not the user's wallet, and it
 * never presets a stake. The addresses are the real devnet Pre-IPO Series and one of its settled Windows, so nothing
 * here pretends to be a live market; a tap on the example only leaves example mode.
 */
import { toAddress, type EventMarket, type LaneSet, toMarketId } from "@agari/core/types";
import { pickHedge, type HedgePick } from "./hedge-target";
import type { HoldingView } from "./useHoldings";

const OPENAI_PRICE_E8 = 112_738_000_000n;
const TSLA_PRICE_E8 = 35_979_500_000n;
const E10 = 10n ** 10n;

const holding = (symbol: HoldingView["symbol"], issuer: HoldingView["issuer"], underlying: HoldingView["underlying"], sharesE8: bigint, priceE8: bigint): HoldingView => ({
  mint: `example-${symbol}`,
  symbol,
  issuer,
  underlying,
  sharesE8,
  exposureUsdE6: (sharesE8 * priceE8) / E10,
  priceAgeSec: 0,
});

/** 4.2 OPENAI PreStocks ≈ $4,735, plus 12.5 TSLAx that has no Window in this example (so the picker skips it). */
export const EXAMPLE_HOLDINGS: readonly HoldingView[] = [
  holding("OPENAI", "prestocks", "OPENAI", 420_000_000n, OPENAI_PRICE_E8),
  holding("TSLAx", "xstocks", "TSLA", 1_250_000_000n, TSLA_PRICE_E8),
];

const SERIES = toAddress("C8JCSGPmf4bvBN1aiwGP4gGqt2JRfcJPCdhK8PWWTYKH");
const MARKET = toMarketId("5rJGBvRQGDE8TrQ5Z22Tscmc3wBsrUPveA7qZ4ttwTor");
const BOOK = toAddress("EVtZLCP9hawvHw9a7ehNxkbTBz7bi4hjifs99vpVBN6r");

/** A one-hour OpenAI Window that opened half an hour ago, so it is trading whenever the example is shown. */
function exampleWindow(nowSec: number): EventMarket {
  const expirySec = nowSec + 1_800;
  return {
    marketId: MARKET,
    venueId: null,
    asset: "OPENAI",
    lane: "token",
    question: "",
    intervalSec: 3_600,
    tradingStartSec: expirySec - 3_600,
    lockAtSec: expirySec,
    expirySec,
    poolAddress: BOOK,
    marketAddress: MARKET,
    seriesAddress: SERIES,
    nonce: null,
    policyVersion: 1,
    printSource: "attested",
    collateral: SERIES,
    decimals: 6,
    status: "Trading",
    winningOutcome: null,
    voided: false,
    voidReason: null,
    finalized: null,
    openingPriceRaw: OPENAI_PRICE_E8,
    volumeQuoteRaw: 0n,
    tradeCount: 0,
    lastPriceRaw: null,
    resolvedAtMs: null,
  };
}

/** The example pick, or null if the real picker would not offer one (it always should; the fixture test pins it). */
export function examplePick(nowSec: number): HedgePick | null {
  const market = exampleWindow(nowSec);
  const laneSet: LaneSet = { venueId: SERIES, lanes: [{ basis: "token", intervalSec: 3_600, label: "", markets: [market], nextStartSec: null }] };
  return pickHedge([...EXAMPLE_HOLDINGS], laneSet, nowSec * 1000);
}
