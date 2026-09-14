import type { QuoteTarget } from "@agari/core/ports";
import type { MarketId } from "@agari/core/types";
import type { Address } from "@solana/kit";
import { describe, expect, it } from "vitest";
import type { SeriesFacts } from "./accounts";
import { bookBytes } from "./book-bytes.fixture";
import { decodeBook } from "./decode";
import { quoteFromBook, toBookDepth } from "./mappers";

const MARKET = "BKkTERCDMQK17uLvBxVTTJfWMx5t4zzesJVhFFoGH252";
const NOW = 1_789_416_000;
/** The launch grid (D-026): lot = tick = 1,000 base units, cash unit 1, min 1,000 lots, 6 dp. */
const series: SeriesFacts = {
  address: "FK9jirQBjhCLMEgzKvPNNtMXBrxSA6aWerMcWz9WVXvZ" as Address,
  symbol: "TSLA", basis: 0, cadenceSec: 300, lotBase: 1_000n, tickBase: 1_000n, cashUnit: 1n, minLots: 1_000n,
  seatBond: 250_000n, fillsCap: 16, evictionsCap: 16, minRestSlots: 50n,
};
const target: QuoteTarget = { marketId: MARKET as MarketId, poolAddress: "8xPqjTVYdsu2f4fZo2EDuhkSxFrioZECnypZKfqW97m2" as QuoteTarget["poolAddress"], decimals: 6, intervalSec: 300 };
const order = (price: number, lots: bigint, expireTs = BigInt(NOW + 60)) => ({ price, lots, expireTs, placedSlot: 400_000_000n, live: true });
// YES bid 480 × 5,000; YES asks 520 × 5,000 and 530 × 10,000; an expired ask at 510 must never be quoted.
const book = decodeBook(target.poolAddress as unknown as Address, bookBytes([order(480, 5_000n)], [order(510, 99_000n, BigInt(NOW)), order(520, 5_000n), order(530, 10_000n)], MARKET as Address), 400_000_100n);

describe("toBookDepth", () => {
  it("shows the YES book in Up/Down terms, dropping expired orders", () => {
    const depth = toBookDepth(book, series, 6, NOW);
    expect(depth.upAsks).toEqual([
      { priceRaw: 520_000n, priceBps: 5_200, quantityRaw: 5_000_000n },
      { priceRaw: 530_000n, priceBps: 5_300, quantityRaw: 10_000_000n },
    ]);
    expect(depth.upBids).toEqual([{ priceRaw: 480_000n, priceBps: 4_800, quantityRaw: 5_000_000n }]);
    expect(depth.downAsks).toEqual([{ priceRaw: 520_000n, priceBps: 5_200, quantityRaw: 5_000_000n }]);
    expect(depth.downBids.map((l) => l.priceBps)).toEqual([4_800, 4_700]);
  });
});

describe("quoteFromBook (the ticket's and the submitter's one kernel)", () => {
  // 300 s cadence: cost-cap buffer 15,661 bps → slippage 5,661 bps over the last crossed level.
  it("Up: walks both asks, pads the limit, caps size by the stake at the padded limit", () => {
    const quote = quoteFromBook(book, series, target, "up", 10_000_000n, NOW)!;
    // limit 530 + ⌊530 × 5,661 / 10⁴⌋ = 830; ⌊10,000,000 / 830⌋ = 12,048 lots of the 15,000 crossed.
    expect(quote).toMatchObject({
      side: "up", contractsRaw: 12_048_000n, limitPriceRaw: 830_000n, maxCostBase: 9_999_840n, fillableStakeBase: 9_999_840n,
      // 5,000 × 520 + 7,048 × 530 = 6,335,440; VWAP ⌈525.85⌉ = 526 ticks.
      expectedCostBase: 6_335_440n, avgPriceBps: 5_260, oddsCents: 53, payoutIfRightBase: 12_048_000n, partial: false, feeBps: 0, decimals: 6,
    });
  });

  it("Down: buys NO against the YES bid at 1000 − 480 and sends the limit in YES terms", () => {
    const quote = quoteFromBook(book, series, target, "down", 10_000_000n, NOW)!;
    // limit 520 + 294 = 814 in NO terms → 186 YES ticks; only 5,000 lots rest, so most of the stake stays home.
    expect(quote).toMatchObject({
      side: "down", contractsRaw: 5_000_000n, limitPriceRaw: 186_000n, maxCostBase: 4_070_000n, expectedCostBase: 2_600_000n,
      avgPriceBps: 5_200, payoutIfRightBase: 5_000_000n, partial: true,
    });
  });

  it("is null below min_lots and on an empty side", () => {
    expect(quoteFromBook(book, series, target, "up", 400_000n, NOW)).toBeNull();
    const asksOnly = decodeBook(book.address, bookBytes([], [order(520, 5_000n)], MARKET as Address), 400_000_100n);
    expect(quoteFromBook(asksOnly, series, target, "down", 10_000_000n, NOW)).toBeNull();
  });
});
