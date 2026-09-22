import { describe, expect, it } from "vitest";
import { BASKET_INDEX_BASE_E8 } from "@agari/core/market";
import { toAddress, toMarketId, type EventMarket, type LaneSet } from "@agari/core/types";
import { pickBasketHedges } from "./basket-cover";
import { hedgeStakeBase } from "./hedge-size";
import { pickAllHedges } from "./hedge-target";
import type { HoldingView } from "./useHoldings";

/** Saturday 2026-09-19 14:00Z: a weekend, so a token Window's horizon is the weekend. */
const NOW_SEC = 1_789_826_400;
const NOW_MS = NOW_SEC * 1000;
const E10 = 10n ** 10n;
const ADDRESS = toAddress("C8JCSGPmf4bvBN1aiwGP4gGqt2JRfcJPCdhK8PWWTYKH");

const holding = (symbol: "OPENAI" | "ANTHROPIC" | "KALSHI" | "TSLAx", underlying: "OPENAI" | "ANTHROPIC" | "KALSHI" | "TSLA", sharesE8: bigint, priceE8: bigint | null): HoldingView => ({
  mint: `m-${symbol}`,
  symbol,
  issuer: symbol === "TSLAx" ? "xstocks" : "prestocks",
  underlying,
  sharesE8,
  exposureUsdE6: priceE8 === null ? null : (sharesE8 * priceE8) / E10,
  priceAgeSec: priceE8 === null ? null : 0,
});

function window(asset: EventMarket["asset"], id: string, expirySec = NOW_SEC + 1_800): EventMarket {
  return {
    marketId: toMarketId(id),
    venueId: null,
    asset,
    lane: "token",
    question: "",
    intervalSec: 3_600,
    tradingStartSec: expirySec - 3_600,
    lockAtSec: expirySec,
    expirySec,
    poolAddress: ADDRESS,
    marketAddress: toMarketId(id),
    seriesAddress: ADDRESS,
    nonce: null,
    policyVersion: 1,
    printSource: "attested",
    collateral: ADDRESS,
    decimals: 6,
    status: "Trading",
    winningOutcome: null,
    voided: false,
    voidReason: null,
    finalized: null,
    openingPriceRaw: asset === "AILABS" ? BASKET_INDEX_BASE_E8 : 112_738_000_000n,
    volumeQuoteRaw: 0n,
    tradeCount: 0,
    lastPriceRaw: null,
    resolvedAtMs: null,
  };
}
const lanes = (...markets: EventMarket[]): LaneSet => ({ venueId: ADDRESS, lanes: [{ basis: "token", intervalSec: 3_600, label: "", markets, nextStartSec: null }] });

const AILABS_WINDOW = window("AILABS", "5rJGBvRQGDE8TrQ5Z22Tscmc3wBsrUPveA7qZ4ttwTor");
const OPENAI_WINDOW = window("OPENAI", "EVtZLCP9hawvHw9a7ehNxkbTBz7bi4hjifs99vpVBN6r");
const OPENAI = holding("OPENAI", "OPENAI", 420_000_000n, 112_738_000_000n);
const ANTHROPIC = holding("ANTHROPIC", "ANTHROPIC", 200_000_000n, 103_120_000_000n);
const KALSHI = holding("KALSHI", "KALSHI", 100_000_000n, 87_000_000_000n);
const TSLAX = holding("TSLAx", "TSLA", 1_250_000_000n, 35_979_500_000n);

describe("pickBasketHedges (S19 A6)", () => {
  it("offers a basket only with two or more held members and its Window trading, summing what is held", () => {
    const [pick] = pickBasketHedges([OPENAI, ANTHROPIC, TSLAX], lanes(AILABS_WINDOW), NOW_MS);
    expect(pick).toBeDefined();
    expect(pick!.underlying).toBe("AILABS");
    expect(pick!.holdings.map((h) => h.symbol)).toEqual(["OPENAI", "ANTHROPIC"]);
    expect(pick!.sharesE8).toBe(620_000_000n);
    // 4.2 × 1,127.38 + 2 × 1,031.20 = $6,797.396: the members' values together, so the 10 % preset sizes on both.
    expect(pick!.exposureUsdE6).toBe(6_797_396_000n);
    expect(pick!.target).toEqual({ market: AILABS_WINDOW, kind: "down", horizon: "weekend" });
    expect(hedgeStakeBase({ exposureUsdE6: pick!.exposureUsdE6, decimals: 6, ticketMaxBase: null, balanceBase: 10_000_000_000n })).toBe(679_739_600n);
    // FRONTIER and PREALL hold these two names too, but only baskets with a trading Window are offered.
    expect(pickBasketHedges([OPENAI, ANTHROPIC], lanes(AILABS_WINDOW), NOW_MS).map((p) => p.underlying)).toEqual(["AILABS"]);
  });

  it("never offers a basket for one held member, without a Window, or when the feed calls it calm", () => {
    expect(pickBasketHedges([OPENAI, TSLAX], lanes(AILABS_WINDOW), NOW_MS)).toEqual([]);
    expect(pickBasketHedges([OPENAI, ANTHROPIC], lanes(OPENAI_WINDOW), NOW_MS)).toEqual([]);
    expect(pickBasketHedges([OPENAI, ANTHROPIC], lanes(AILABS_WINDOW), NOW_MS, new Set(["AILABS"]))).toEqual([]);
    expect(pickBasketHedges([OPENAI, ANTHROPIC], null, NOW_MS)).toEqual([]);
  });

  it("leaves the exposure null when any held member is unpriced, rather than understating it", () => {
    const [pick] = pickBasketHedges([OPENAI, holding("ANTHROPIC", "ANTHROPIC", 200_000_000n, null)], lanes(AILABS_WINDOW), NOW_MS);
    expect(pick!.exposureUsdE6).toBeNull();
  });

  it("rides along in pickAllHedges after the single names, sorted by exposure", () => {
    const picks = pickAllHedges([OPENAI, ANTHROPIC, KALSHI], lanes(AILABS_WINDOW, OPENAI_WINDOW), NOW_MS);
    expect(picks.map((p) => p.underlying)).toEqual(["AILABS", "OPENAI"]);
    expect(picks[0]!.exposureUsdE6! > picks[1]!.exposureUsdE6!).toBe(true);
  });
});
