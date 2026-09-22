import { describe, expect, it } from "vitest";
import { BASKET_INDEX_BASE_E8, BASKETS, type PreIpoSymbol } from "@agari/core/market";
import { basketIndexAt, basketIndexHistory, basketIndexLatest, indexOfSnapshot } from "./basket-index";
import type { PreStocksSample, PreStocksSnapshot } from "./prestocks-spot";

const NOW = 1_789_800_000;
const AILABS = BASKETS.AILABS;
const sampleOf = (symbol: PreIpoSymbol, tokenPriceE8: bigint, fetchedAtSec: number): PreStocksSample => ({ symbol, mint: "m", tokenPriceE8, markPriceE8: 1n, fetchedAtSec });
/** Every AI Labs member at `factorBps / 10,000` of its base; `omit` leaves one out, as a dropped catalogue row would. */
const read = (fetchedAtSec: number, factorBps: bigint, omit?: PreIpoSymbol): PreStocksSnapshot => ({
  fetchedAtSec,
  samples: new Map(AILABS.members.filter((m) => m.symbol !== omit).map((m) => [m.symbol, sampleOf(m.symbol, (m.basePriceE8! * factorBps) / 10_000n, fetchedAtSec)])),
  missing: omit ? [omit] : [],
});

describe("indexOfSnapshot", () => {
  it("is the core index over one read's member prices, and null when the read lacks a member", () => {
    expect(indexOfSnapshot(AILABS, read(NOW, 10_000n))).toEqual({ symbol: "AILABS", indexE8: BASKET_INDEX_BASE_E8, fetchedAtSec: NOW });
    expect(indexOfSnapshot(AILABS, read(NOW, 20_000n))?.indexE8).toBe(BASKET_INDEX_BASE_E8 * 2n);
    expect(indexOfSnapshot(AILABS, read(NOW, 10_000n, "ANTHROPIC"))).toBeNull();
    // A member the read priced at zero is not a price: the index is null, never a partial sum.
    const zero = read(NOW, 10_000n);
    (zero.samples as Map<PreIpoSymbol, PreStocksSample>).set("OPENAI", sampleOf("OPENAI", 0n, NOW));
    expect(indexOfSnapshot(AILABS, zero)).toBeNull();
  });
});

describe("history, latest and at over snapshots", () => {
  const snapshots = [read(NOW - 40, 10_000n), read(NOW - 30, 10_000n, "OPENAI"), read(NOW - 20, 20_000n), read(NOW - 10, 30_000n, "ANTHROPIC")];

  it("keeps only complete reads, oldest first", () => {
    expect(basketIndexHistory(snapshots, AILABS).map((s) => [s.fetchedAtSec, s.indexE8])).toEqual([[NOW - 40, BASKET_INDEX_BASE_E8], [NOW - 20, BASKET_INDEX_BASE_E8 * 2n]]);
  });

  it("answers latest from the newest complete read inside the age budget, skipping an incomplete newer one", () => {
    expect(basketIndexLatest(snapshots, AILABS, NOW)).toMatchObject({ fetchedAtSec: NOW - 20, indexE8: BASKET_INDEX_BASE_E8 * 2n });
    expect(basketIndexLatest(snapshots, AILABS, NOW, 15)).toBeNull();
    expect(basketIndexLatest([], AILABS, NOW)).toBeNull();
  });

  it("answers at(sec) from the newest complete read at or before sec, only inside the window", () => {
    expect(basketIndexAt(snapshots, AILABS, NOW - 25)).toMatchObject({ fetchedAtSec: NOW - 40 });
    expect(basketIndexAt(snapshots, AILABS, NOW - 25, 10)).toBeNull();
    expect(basketIndexAt(snapshots, AILABS, NOW - 5)).toMatchObject({ fetchedAtSec: NOW - 20 });
    expect(basketIndexAt(snapshots, AILABS, NOW - 41)).toBeNull();
  });
});
