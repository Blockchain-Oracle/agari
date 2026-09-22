import { describe, expect, it, vi } from "vitest";
import { BASKET_INDEX_BASE_E8, BASKETS } from "@agari/core/market";

const asciiHex = (ascii: string) => {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < ascii.length; i++) bytes[i] = ascii.charCodeAt(i);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

// The prints barrel re-exports Pyth modules that do not load in this environment; only these three names are needed.
vi.mock("@agari/markets/ops/prints", () => ({
  PRESTOCKS_MAX_LATE_SEC: 45,
  preStocksFeedHex: (symbol: string) => asciiHex(`prestocks-v1:${symbol}`),
  preStocksBasketFeedHex: (symbol: string) => asciiHex(`prestocks-basket-v1:${symbol}`),
  copyOpenSlot: vi.fn(),
  recordAttestedSlot: vi.fn(),
  SWITCHBOARD_ERROR: { printNotAdjacent: "printNotAdjacent", printsMissing: "printsMissing" },
}));
vi.mock("@agari/markets/ops", () => ({ keypairSigner: vi.fn() }));

const { choosePrint, chooseSample, isPreStocksSlot, TARGET_BY_FEED } = await import("./prestocks-pass");
import type { PreStocksSample, PreStocksSnapshot } from "../../prices/prestocks-spot";
import type { PrintSlot } from "@agari/markets/ops/prints";

const T = 1_789_800_000;
const sample = (fetchedAtSec: number): PreStocksSample => ({ symbol: "OPENAI", mint: "m", tokenPriceE8: 112_738_000_000n, markPriceE8: 98_000_000_000n, fetchedAtSec });
const slot = { boundarySec: T, earliestSec: T + 10 };

describe("chooseSample", () => {
  it("takes the first read inside [T+10, T+45] and never one outside it", () => {
    const history = [sample(T - 20), sample(T + 5), sample(T + 12), sample(T + 22), sample(T + 60)];
    expect(chooseSample(history, slot, T + 30)).toEqual({ sample: sample(T + 12) });
    expect(chooseSample([sample(T + 5), sample(T + 46)], slot, T + 50)).toMatchObject({ missed: expect.stringContaining("voids") });
  });
  it("waits while the window is still open and no read has landed, and gives up once it has closed", () => {
    expect(chooseSample([sample(T + 5)], slot, T + 20)).toMatchObject({ waiting: expect.stringContaining("no PreStocks read yet") });
    expect(chooseSample([], slot, T + 45)).toMatchObject({ waiting: expect.any(String) });
    expect(chooseSample([], slot, T + 46)).toMatchObject({ missed: expect.any(String) });
  });
});

describe("isPreStocksSlot", () => {
  const hex = asciiHex;
  it("routes a basket feed here too, to its basket (S19)", () => {
    expect(isPreStocksSlot({ source: "attested", feedIdHex: hex("prestocks-basket-v1:AILABS"), basis: "token" } as PrintSlot)).toBe(true);
    expect(TARGET_BY_FEED.get(hex("prestocks-basket-v1:PREALL"))).toEqual({ kind: "basket", basket: BASKETS.PREALL });
    expect(TARGET_BY_FEED.get(hex("prestocks-v1:OPENAI"))).toEqual({ kind: "name", symbol: "OPENAI" });
    expect(TARGET_BY_FEED.get(hex("prestocks-basket-v2:AILABS"))).toBeUndefined();
  });
  it("keys on the feed id, not the lane, so a PreStocks slot on any basis is routed here", () => {
    expect(isPreStocksSlot({ source: "attested", feedIdHex: hex("prestocks-v1:OPENAI"), basis: "regular" } as PrintSlot)).toBe(true);
    expect(isPreStocksSlot({ source: "attested", feedIdHex: hex("prestocks-v1:SPACEX"), basis: "token" } as PrintSlot)).toBe(true);
    expect(isPreStocksSlot({ source: "attested", feedIdHex: hex("agari-drive-attested:TSLA"), basis: "regular" } as PrintSlot)).toBe(false);
    expect(isPreStocksSlot({ source: "switchboard", feedIdHex: hex("prestocks-v1:OPENAI"), basis: "token" } as PrintSlot)).toBe(false);
  });
});

describe("choosePrint", () => {
  const ailabsRead = (fetchedAtSec: number, factorBps: bigint, omit?: string): PreStocksSnapshot => ({
    fetchedAtSec,
    samples: new Map(BASKETS.AILABS.members.filter((m) => m.symbol !== omit).map((m) => [m.symbol, { symbol: m.symbol, mint: "m", tokenPriceE8: (m.basePriceE8! * factorBps) / 10_000n, markPriceE8: 1n, fetchedAtSec }])),
    missing: [],
  });
  const feed = {
    history: () => [sample(T + 5), sample(T + 12)],
    snapshots: () => [ailabsRead(T + 12, 10_000n, "ANTHROPIC"), ailabsRead(T + 22, 20_000n), ailabsRead(T + 32, 30_000n)],
  };

  it("prints a name's token price in dollars and a basket's index in points, each from its first complete read in the window", () => {
    expect(choosePrint(feed, { kind: "name", symbol: "OPENAI" }, slot, T + 30)).toEqual({ priceE8: 112_738_000_000n, fetchedAtSec: T + 12, unit: "e-8" });
    // T+12 priced only OPENAI, so the basket's first complete read is T+22: 2,000 pts, never a partial sum at T+12.
    expect(choosePrint(feed, { kind: "basket", basket: BASKETS.AILABS }, slot, T + 30)).toEqual({ priceE8: BASKET_INDEX_BASE_E8 * 2n, fetchedAtSec: T + 22, unit: "e-8 pts" });
  });

  it("waits, then voids, when no complete read lands inside the window", () => {
    const partial = { history: () => [], snapshots: () => [ailabsRead(T + 20, 10_000n, "OPENAI")] };
    expect(choosePrint(partial, { kind: "basket", basket: BASKETS.AILABS }, slot, T + 30)).toMatchObject({ waiting: expect.stringContaining("1 read(s) missed a member") });
    expect(choosePrint(partial, { kind: "basket", basket: BASKETS.AILABS }, slot, T + 46)).toMatchObject({ missed: expect.stringContaining("voids") });
  });
});
