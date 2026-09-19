import { describe, expect, it, vi } from "vitest";

// The prints barrel re-exports Pyth modules that do not load in this environment; only these three names are needed.
vi.mock("@agari/markets/ops/prints", () => ({
  PRESTOCKS_MAX_LATE_SEC: 45,
  preStocksFeedHex: (symbol: string) => {
    const bytes = new Uint8Array(32);
    const ascii = `prestocks-v1:${symbol}`;
    for (let i = 0; i < ascii.length; i++) bytes[i] = ascii.charCodeAt(i);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  },
  copyOpenSlot: vi.fn(),
  recordAttestedSlot: vi.fn(),
  SWITCHBOARD_ERROR: { printNotAdjacent: "printNotAdjacent", printsMissing: "printsMissing" },
}));
vi.mock("@agari/markets/ops", () => ({ keypairSigner: vi.fn() }));

const { chooseSample, isPreStocksSlot } = await import("./prestocks-pass");
import type { PreStocksSample } from "../../prices/prestocks-spot";
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
  const hex = (ascii: string) => {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < ascii.length; i++) bytes[i] = ascii.charCodeAt(i);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  };
  it("keys on the feed id, not the lane, so a PreStocks slot on any basis is routed here", () => {
    expect(isPreStocksSlot({ source: "attested", feedIdHex: hex("prestocks-v1:OPENAI"), basis: "regular" } as PrintSlot)).toBe(true);
    expect(isPreStocksSlot({ source: "attested", feedIdHex: hex("prestocks-v1:SPACEX"), basis: "token" } as PrintSlot)).toBe(true);
    expect(isPreStocksSlot({ source: "attested", feedIdHex: hex("agari-drive-attested:TSLA"), basis: "regular" } as PrintSlot)).toBe(false);
    expect(isPreStocksSlot({ source: "switchboard", feedIdHex: hex("prestocks-v1:OPENAI"), basis: "token" } as PrintSlot)).toBe(false);
  });
});
