import { describe, expect, it } from "vitest";
import { err, ok, stale } from "../schemas/reading";
import { diagnosis } from "../types/diagnosis";
import { toMarketId, type EventMarket } from "../types/market";
import type { BookDepth, BookLevelView } from "../types/trading";
import { termBand, termPoints } from "./term";

const D = 6;
const UNIT = 10n ** BigInt(D);
const NOW_MS = Date.UTC(2026, 8, 3, 9, 0, 0);
const NOW_SEC = NOW_MS / 1000;
const level = (cents: number, contracts: number): BookLevelView => ({ priceRaw: BigInt(cents) * (UNIT / 100n), priceBps: cents * 100, quantityRaw: BigInt(contracts) * UNIT });
const book = (bid: number | null, ask: number | null): BookDepth => ({
  upBids: bid === null ? [] : [level(bid, 5)],
  upAsks: ask === null ? [] : [level(ask, 5)],
  downBids: [],
  downAsks: [],
  decimals: D,
});
const id = (n: number) => toMarketId(`0x${n.toString(16).padStart(64, "0")}`);
function market(n: number, intervalSec: number, expiresInSec: number): EventMarket {
  return {
    marketId: id(n),
    venueId: null,
    asset: "BTC",
    question: "",
    intervalSec,
    strikeRaw: 0n,
    isUpDown: true,
    tradingStartSec: NOW_SEC + expiresInSec - intervalSec,
    expirySec: NOW_SEC + expiresInSec,
    poolAddress: "0x0000000000000000000000000000000000000001",
    marketAddress: "0x0000000000000000000000000000000000000002",
    nonce: null,
    yesTokenId: 0n,
    noTokenId: 0n,
    collateral: "0x0000000000000000000000000000000000000003",
    decimals: D,
    status: "Trading",
    winningOutcome: null,
    voided: false,
    finalized: null,
    openingPriceRaw: 7_795_612n,
    oracleQuestionId: null,
    volumeQuoteRaw: 0n,
    tradeCount: 0,
    lastPriceRaw: null,
    resolvedAtMs: null,
  };
}

describe("termPoints", () => {
  it("orders every live Window by close and prices each off its own book", () => {
    const points = termPoints(
      [
        { market: market(3, 3_600, 2_400), book: ok(book(58, 62), NOW_MS) },
        { market: market(1, 300, 120), book: ok(book(60, 64), NOW_MS) },
        { market: market(2, 900, 700), book: ok(book(null, 55), NOW_MS) },
      ],
      NOW_MS,
    );
    expect(points.map((p) => p.cadence)).toEqual(["5m", "15m", "1h"]);
    expect(points.map((p) => p.remainingSec)).toEqual([120, 700, 2_400]);
    expect(points[0]!.implied).toEqual({ bps: 6_200, basis: "mid" });
    expect(points[1]!.implied).toEqual({ bps: 5_500, basis: "ask" });
    expect(points[2]!.structure?.spreadBps).toBe(400);
  });

  it("carries hydrating, stale and unavailable through rather than inventing a price", () => {
    const [hydrating, aged, broken] = termPoints(
      [
        { market: market(1, 300, 100), book: null },
        { market: market(2, 300, 200), book: stale(ok(book(60, 64), NOW_MS - 30_000), "offline") },
        { market: market(3, 300, 300), book: err(diagnosis("rpc-down", "boom")) },
      ],
      NOW_MS,
    );
    expect(hydrating!.structure).toBeNull();
    expect(hydrating!.implied).toBeNull();
    expect(aged!.stale).toBe(true);
    expect(aged!.implied?.bps).toBe(6_200);
    expect(broken!.unavailable).toBe(true);
    expect(broken!.implied).toBeNull();
  });

  it("draws the band around the points, never narrower than the floor", () => {
    const points = termPoints([{ market: market(1, 300, 100), book: ok(book(60, 64), NOW_MS) }], NOW_MS);
    expect(termBand(points)).toEqual({ minBps: 5_700, maxBps: 6_700 });
    expect(termBand([])).toBeNull();
  });
});
