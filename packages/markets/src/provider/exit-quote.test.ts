import { describe, expect, it } from "vitest";
import type { Address } from "@solana/kit";
import type { SeriesFacts } from "../runtime/accounts";
import { bookBytes, type FixtureOrder } from "../runtime/book-bytes.fixture";
import { decodeBook } from "../runtime/decode";
import { exitQuoteFromBook } from "./exit-quote";

const NOW = 1_788_400_000;
const series = { lotBase: 1_000n, tickBase: 1_000n, cashUnit: 1n, minLots: 1_000n, minRestSlots: 50n } as SeriesFacts;
const order = (price: number, lots: bigint): FixtureOrder => ({ price, lots, expireTs: BigInt(NOW + 300), placedSlot: 1n, live: true });
const book = (bids: FixtureOrder[], asks: FixtureOrder[]) => decodeBook("Book111111111111111111111111111111111111111" as Address, bookBytes(bids, asks), 1_000n);

describe("exit quote (L-35): the cash-out sells into the Book in its own terms", () => {
  it("Up sells YES into the bids as they are, padded down from the last level reached", () => {
    // Bids 600 × 2,000 and 550 × 3,000; selling 4,000 lots reaches 550.
    const exit = exitQuoteFromBook(book([order(600, 2_000n), order(550, 3_000n)], []), series, "up", 4_000n, NOW)!;
    expect(exit.contractsRaw).toBe(4_000_000n);
    expect(exit.expectedProceedsBase).toBe(2_000n * 600n + 2_000n * 550n);
    // max(⌊550 × 300 / 10,000⌋ = 16, 10) → 534 own = YES.
    expect(exit.limitPriceRaw).toBe(534_000n);
    expect(exit.minProceedsBase).toBe(4_000n * 534n);
    expect(exit.avgPriceBps).toBe(5_750);
  });

  it("Down sells NO into the asks inverted, and the order's YES price is the complement", () => {
    // Asks 300 × 5,000 → a NO seller receives 700 per lot.
    const exit = exitQuoteFromBook(book([], [order(300, 5_000n)]), series, "down", 1_500n, NOW)!;
    expect(exit.contractsRaw).toBe(1_500_000n);
    expect(exit.expectedProceedsBase).toBe(1_500n * 700n);
    // max(⌊700 × 300 / 10,000⌋ = 21, 10) → 679 own, YES 321.
    expect(exit.limitPriceRaw).toBe(321_000n);
    expect(exit.minProceedsBase).toBe(1_500n * 679n);
  });

  it("sells no more than the Book holds, pads by at least 10 ticks, floors the limit at 1", () => {
    const thin = exitQuoteFromBook(book([order(5, 1_200n)], []), series, "up", 9_000n, NOW)!;
    expect(thin.contractsRaw).toBe(1_200_000n);
    expect(thin.limitPriceRaw).toBe(1_000n);
    expect(thin.minProceedsBase).toBe(1_200n);
  });

  it("is null with nothing to sell into, nothing held, or less than the Series minimum fillable", () => {
    expect(exitQuoteFromBook(book([], [order(300, 5_000n)]), series, "up", 1_000n, NOW)).toBeNull();
    expect(exitQuoteFromBook(book([order(600, 2_000n)], []), series, "up", 0n, NOW)).toBeNull();
    expect(exitQuoteFromBook(book([order(600, 999n)], []), series, "up", 5_000n, NOW)).toBeNull();
    const expired = { ...order(600, 5_000n), expireTs: BigInt(NOW) };
    expect(exitQuoteFromBook(book([expired], []), series, "up", 1_000n, NOW)).toBeNull();
  });
});
