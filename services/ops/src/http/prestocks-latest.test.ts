import { describe, expect, it } from "vitest";
import type { PreStocksSample, PreStocksSpotFeed } from "../prices/prestocks-spot";
import { movementOf, premiumBps, preStocksLatestBody } from "./prestocks-latest";

const NOW = 1_789_800_000;
const sample = (fetchedAtSec: number, tokenPriceE8 = 112_738_444_694n): PreStocksSample => ({ symbol: "OPENAI", mint: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF", tokenPriceE8, markPriceE8: 98_115_613_670n, fetchedAtSec });
const feedOf = (samples: PreStocksSample[]): PreStocksSpotFeed => ({
  latest: () => samples.at(-1) ?? null,
  at: () => null,
  history: () => samples,
  symbols: () => ["OPENAI"],
  subscribe: () => () => undefined,
});

describe("/prestocks/latest", () => {
  it("computes the premium in integer basis points with bigint math", () => {
    // 1,127.38 over a 981.16 mark is +14.90%: 1490 bps, truncated toward zero.
    expect(premiumBps(112_738_444_694n, 98_115_613_670n)).toBe(1490);
    expect(premiumBps(12_132_000_000n, 15_265_000_000n)).toBe(-2052);
    expect(premiumBps(1n, 0n)).toBeNull();
  });

  it("serves the newest sample with its age and freshness, and omits a name with no sample", () => {
    const body = preStocksLatestBody(feedOf([sample(NOW - 3_600), sample(NOW - 12)]), NOW);
    expect(body.OPENAI).toEqual({ tokenPriceE8: "112738444694", markPriceE8: "98115613670", premiumBps: 1490, fetchedAtSec: NOW - 12, ageSec: 12, fresh: true, move: { windowSec: 3_588, samples: 2, rangeBps: 0, changeBps: 0 } });
    expect(preStocksLatestBody(feedOf([]), NOW)).toEqual({});
    expect(preStocksLatestBody(feedOf([sample(NOW - 600)]), NOW).OPENAI?.fresh).toBe(false);
    expect(preStocksLatestBody(feedOf([sample(NOW - 600)]), NOW).OPENAI?.move).toBeNull();
  });

  it("measures the move high to low and first to last in integer basis points (the web's calm judgement reads it)", () => {
    // 1,000.00 → 1,023.00 → 990.00: range 3.33% of the low, change −1%.
    const flat = movementOf([sample(NOW - 7_200, 100_000_000_000n), sample(NOW, 100_000_000_000n)]);
    expect(flat).toEqual({ windowSec: 7_200, samples: 2, rangeBps: 0, changeBps: 0 });
    const moved = movementOf([sample(NOW - 7_200, 100_000_000_000n), sample(NOW - 3_600, 102_300_000_000n), sample(NOW, 99_000_000_000n)]);
    expect(moved).toEqual({ windowSec: 7_200, samples: 3, rangeBps: 333, changeBps: -100 });
    expect(movementOf([sample(NOW)])).toBeNull();
  });
});
