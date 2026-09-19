import { describe, expect, it } from "vitest";
import type { PreStocksSample, PreStocksSpotFeed } from "../prices/prestocks-spot";
import { premiumBps, preStocksLatestBody } from "./prestocks-latest";

const NOW = 1_789_800_000;
const sample = (fetchedAtSec: number): PreStocksSample => ({ symbol: "OPENAI", mint: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF", tokenPriceE8: 112_738_444_694n, markPriceE8: 98_115_613_670n, fetchedAtSec });
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
    expect(body.OPENAI).toEqual({ tokenPriceE8: "112738444694", markPriceE8: "98115613670", premiumBps: 1490, fetchedAtSec: NOW - 12, ageSec: 12, fresh: true });
    expect(preStocksLatestBody(feedOf([]), NOW)).toEqual({});
    expect(preStocksLatestBody(feedOf([sample(NOW - 600)]), NOW).OPENAI?.fresh).toBe(false);
  });
});
