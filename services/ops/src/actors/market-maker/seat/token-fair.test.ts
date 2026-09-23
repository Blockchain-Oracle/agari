import { describe, expect, it, vi } from "vitest";

// The feeds are injected per call; their modules pull the Pyth SDK, which this unit test has no use for.
vi.mock("../../../prices/xstock-spot", () => ({ currentXStockSpot: () => null }));
vi.mock("../../../prices/prestocks-spot", () => ({ currentPreStocksSpot: () => null }));
vi.mock("../../../prices/basket-index", () => ({ basketIndexAt: () => null, basketIndexLatest: () => null }));
vi.mock("./valuation-fair", () => ({ valuationQuote: () => null }));
import type { LaneQuoteInput } from "./lane-quote";
import { sampledQuote, type SampledSource } from "./token-fair";

const NOW = 1_800_000_000;
const START = NOW - 1_800;

/** Only what `sampledQuote` reads: the Window's clock and print, the halts, and the env's knobs. */
function input(openSource: number, openE8: bigint): LaneQuoteInput {
  return {
    symbol: "OPENAI",
    nowSec: NOW,
    halts: {},
    // The Window account's fields as the IDL names them (`expiry`, `tradingStart`); the suffix rule is for our own names.
    market: { data: Object.fromEntries([["lockAt", BigInt(NOW + 1_800)], ["expiry", BigInt(NOW + 1_800)], ["tradingStart", BigInt(START)], ["open", { source: openSource, price: openE8 }]]) },
    env: { spotMaxAgeSec: 30, tokenMaxCashPerWindow: 25_000_000n, sigmaBps: () => 3_000, minTick: 20 },
  } as unknown as LaneQuoteInput;
}

const source = (spot: bigint | null, start: bigint | null): SampledSource => ({ latest: () => spot, at: () => start });

describe("sampledQuote (S23: a restart mid-Window no longer empties the 24/7 books)", () => {
  it("quotes against the sample near the Window's start when this process has one", () => {
    const q = sampledQuote(input(1, 100_00000000n), source(101_00000000n, 100_00000000n), "OPENAI PreStocks");
    expect(q.phase).toBe("quote");
    expect(q.fairTicks).not.toBeNull();
    expect(q.why).toContain("vs start");
  });

  it("falls back to the Window's own opening print when the start sample is missing, with the same fair", () => {
    const withSample = sampledQuote(input(1, 100_00000000n), source(101_00000000n, 100_00000000n), "OPENAI PreStocks");
    const restarted = sampledQuote(input(1, 100_00000000n), source(101_00000000n, null), "OPENAI PreStocks");
    expect(restarted.phase).toBe("quote");
    expect(restarted.fairTicks).toBe(withSample.fairTicks);
    expect(restarted.why).toContain("vs open print");
  });

  it("still waits for the open print, and still pulls on a stale feed", () => {
    expect(sampledQuote(input(0, 0n), source(101_00000000n, null), "OPENAI PreStocks")).toMatchObject({ phase: "quote", fairTicks: null });
    expect(sampledQuote(input(1, 100_00000000n), source(null, null), "OPENAI PreStocks").phase).toBe("pull");
  });
});
