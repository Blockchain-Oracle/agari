import { describe, expect, it, vi } from "vitest";
import { TICKERS } from "@agari/core/market";
import type { PreStocksRead } from "@agari/markets/ops/prints";

// The feed only needs `fetchPreStocks` from the prints barrel, and every test injects its own `read`; the barrel's
// Pyth/Switchboard re-exports are not loadable in this test environment, so the module is stubbed at the boundary.
vi.mock("@agari/markets/ops/prints", () => ({ fetchPreStocks: vi.fn(async () => { throw new Error("not used in tests"); }) }));
import type { SpotFeed, SpotQuote } from "./spot";
import { createPreStocksSpotFeed, joinPreStocksSpot, samplesOf } from "./prestocks-spot";

const OPENAI_MINT = String(TICKERS.OPENAI.preIpo!.mint);
const NOW = 1_789_800_000;

const readOf = (rows: Array<{ symbol: string; mint: string; token: bigint; mark: bigint }>, fetchedAtSec = NOW): PreStocksRead => ({
  tokens: new Map(rows.map((r) => [r.symbol, { symbol: r.symbol, name: r.symbol, mint: r.mint, tokenPriceE8: r.token, markPriceE8: r.mark }])),
  fetchedAtSec,
  ageSec: null,
});

describe("samplesOf", () => {
  it("keeps a row only when its mint is the registry's, and names what it dropped", () => {
    const read = readOf([
      { symbol: "OPENAI", mint: OPENAI_MINT, token: 112_738_444_694n, mark: 98_115_613_670n },
      { symbol: "OPENAI_IMPOSTOR", mint: "PreImpostor1111111111111111111111111111111", token: 1n, mark: 1n },
    ]);
    const { kept, dropped, missing } = samplesOf(read);
    expect(kept.map((s) => s.symbol)).toEqual(["OPENAI"]);
    expect(kept[0]).toMatchObject({ mint: OPENAI_MINT, tokenPriceE8: 112_738_444_694n, markPriceE8: 98_115_613_670n, fetchedAtSec: NOW });
    expect(dropped).toEqual([]);
    // A registry name the catalogue did not carry is simply missing, never invented.
    expect(missing).not.toContain("OPENAI");
  });

  it("drops a registry name whose catalogue mint changed, rather than pricing the wrong token", () => {
    const { kept, dropped } = samplesOf(readOf([{ symbol: "OPENAI", mint: "PreSomethingElse11111111111111111111111111", token: 1n, mark: 1n }]));
    expect(kept).toEqual([]);
    expect(dropped).toHaveLength(1);
    expect(dropped[0]).toContain("OPENAI");
    expect(dropped[0]).toContain(OPENAI_MINT);
  });
});

describe("joinPreStocksSpot", () => {
  const base: SpotFeed = {
    latest: (symbol) => (symbol === "TSLA" ? { symbol: "TSLA", priceE8: 36_800_000_000n, publishTimeSec: NOW, source: "pyth" } : null),
    subscribe: () => () => undefined,
  };

  it("answers a pre-IPO name from the catalogue as source prestocks and leaves the rest to the base feed", async () => {
    const feed = createPreStocksSpotFeed({ log: () => undefined, read: async () => readOf([{ symbol: "OPENAI", mint: OPENAI_MINT, token: 112_738_444_694n, mark: 98_115_613_670n }], Math.floor(Date.now() / 1000)) });
    const seen: SpotQuote[] = [];
    const joined = joinPreStocksSpot(base, feed);
    const off = joined.subscribe((q) => seen.push(q));
    feed.start();
    await new Promise((r) => setTimeout(r, 30));
    feed.stop();
    off();
    expect(joined.latest("OPENAI")).toMatchObject({ symbol: "OPENAI", priceE8: 112_738_444_694n, source: "prestocks" });
    expect(joined.latest("TSLA")).toMatchObject({ symbol: "TSLA", source: "pyth" });
    expect(seen.map((q) => q.symbol)).toEqual(["OPENAI"]);
    expect(feed.history("OPENAI")).toHaveLength(1);
  });

  it("has no quote for a pre-IPO name before a read lands, and never falls back to the base for it", () => {
    const feed = createPreStocksSpotFeed({ log: () => undefined, read: async () => readOf([]) });
    const joined = joinPreStocksSpot(base, feed);
    expect(joined.latest("OPENAI")).toBeNull();
    expect(feed.at("OPENAI", NOW)).toBeNull();
  });
});

describe("nextDelayMs", () => {
  it("polls at the base rate while reads succeed, then backs off 30 s doubling to a 5 min cap", async () => {
    const { nextDelayMs } = await import("./prestocks-spot");
    expect(nextDelayMs(0, 10_000)).toBe(10_000);
    expect(nextDelayMs(1)).toBe(30_000);
    expect(nextDelayMs(2)).toBe(60_000);
    expect(nextDelayMs(4)).toBe(240_000);
    expect(nextDelayMs(5)).toBe(300_000);
    expect(nextDelayMs(40)).toBe(300_000);
  });
});
