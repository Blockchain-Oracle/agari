import { describe, expect, it } from "vitest";
import { BASKET_INDEX_BASE_E8, BASKETS } from "@agari/core/market";
import type { PreStocksSample, PreStocksSnapshot, PreStocksSpotFeed } from "../prices/prestocks-spot";
import { movementOf, preStocksLatestBody, type BasketWire, type PreStocksWire } from "./prestocks-latest";

const NOW = 1_789_800_000;
const sample = (fetchedAtSec: number, tokenPriceE8 = 112_738_444_694n, symbol: PreStocksSample["symbol"] = "OPENAI"): PreStocksSample => ({ symbol, mint: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF", tokenPriceE8, markPriceE8: 98_115_613_670n, fetchedAtSec });
const point = (fetchedAtSec: number, valueE8: bigint) => ({ fetchedAtSec, valueE8 });
const feedOf = (samples: PreStocksSample[], snapshots: PreStocksSnapshot[] = []): PreStocksSpotFeed => ({
  latest: () => samples.at(-1) ?? null,
  at: () => null,
  history: (symbol) => samples.filter((s) => s.symbol === symbol),
  snapshots: () => snapshots,
  symbols: () => ["OPENAI"],
  subscribe: () => () => undefined,
  subscribeSnapshots: () => () => undefined,
});
/** A read pricing every PREDMKTS member at `factorBps / 10,000` of its base. */
const predmktsRead = (fetchedAtSec: number, factorBps: bigint): PreStocksSnapshot => ({
  fetchedAtSec,
  samples: new Map(BASKETS.PREDMKTS.members.map((m) => [m.symbol, sample(fetchedAtSec, (m.basePriceE8! * factorBps) / 10_000n, m.symbol)])),
  missing: [],
});

describe("/prestocks/latest", () => {
  it("serves the newest sample with its age, freshness and premium, and omits a name with no sample", () => {
    const body = preStocksLatestBody(feedOf([sample(NOW - 3_600), sample(NOW - 12)]), NOW);
    // 1,127.38 over a 981.16 mark is +14.90%: 1490 bps, truncated toward zero (core's referencePremiumBps).
    expect(body.OPENAI).toEqual({ tokenPriceE8: "112738444694", markPriceE8: "98115613670", premiumBps: 1490, fetchedAtSec: NOW - 12, ageSec: 12, fresh: true, move: { windowSec: 3_588, samples: 2, rangeBps: 0, changeBps: 0 } });
    expect(preStocksLatestBody(feedOf([]), NOW)).toEqual({});
    expect((preStocksLatestBody(feedOf([sample(NOW - 600)]), NOW).OPENAI as PreStocksWire).fresh).toBe(false);
    expect((preStocksLatestBody(feedOf([sample(NOW - 600)]), NOW).OPENAI as PreStocksWire).move).toBeNull();
  });

  it("measures the move high to low and first to last in integer basis points (the web's calm judgement reads it)", () => {
    // 1,000.00 → 1,023.00 → 990.00: range 3.33% of the low, change −1%.
    const flat = movementOf([point(NOW - 7_200, 100_000_000_000n), point(NOW, 100_000_000_000n)]);
    expect(flat).toEqual({ windowSec: 7_200, samples: 2, rangeBps: 0, changeBps: 0 });
    const moved = movementOf([point(NOW - 7_200, 100_000_000_000n), point(NOW - 3_600, 102_300_000_000n), point(NOW, 99_000_000_000n)]);
    expect(moved).toEqual({ windowSec: 7_200, samples: 3, rangeBps: 333, changeBps: -100 });
    expect(movementOf([point(NOW, 1n)])).toBeNull();
  });

  it("serves a basket row from the newest complete read, in points, with each member's move from its base", () => {
    // Two complete reads (at the base, then every member doubled: exact at any base) and a newer read missing
    // POLYMARKET, which cannot be indexed and so is never the row.
    const partial: PreStocksSnapshot = { fetchedAtSec: NOW - 5, samples: new Map([["KALSHI", sample(NOW - 5, 1n, "KALSHI")]]), missing: ["POLYMARKET"] };
    const body = preStocksLatestBody(feedOf([], [predmktsRead(NOW - 3_600, 10_000n), predmktsRead(NOW - 20, 20_000n), partial]), NOW);
    const row = body.PREDMKTS as BasketWire;
    expect(row.kind).toBe("basket");
    expect(row.indexE8).toBe((BASKET_INDEX_BASE_E8 * 2n).toString());
    expect(row.fetchedAtSec).toBe(NOW - 20);
    expect(row.ageSec).toBe(20);
    expect(row.fresh).toBe(true);
    expect(row.move).toEqual({ windowSec: 3_580, samples: 2, rangeBps: 10_000, changeBps: 10_000 });
    expect(row.members.map((m) => m.symbol)).toEqual(["KALSHI", "POLYMARKET"]);
    expect(row.members.every((m) => m.weightBps === 5_000 && m.moveBps === 10_000)).toBe(true);
    expect(row.members[0]!.tokenPriceE8).toBe((BASKETS.PREDMKTS.members[0]!.basePriceE8! * 2n).toString());
    // Every basket that this feed cannot index is simply absent; a name row never carries `kind`.
    expect(body.AILABS).toBeUndefined();
    expect(body.PREALL).toBeUndefined();
  });

  it("omits a basket with no complete read at all", () => {
    const partial: PreStocksSnapshot = { fetchedAtSec: NOW, samples: new Map([["KALSHI", sample(NOW, 1n, "KALSHI")]]), missing: ["POLYMARKET"] };
    expect(preStocksLatestBody(feedOf([], [partial]), NOW).PREDMKTS).toBeUndefined();
  });
});
