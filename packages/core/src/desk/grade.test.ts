import { describe, expect, it } from "vitest";
import { gradeDecision, NO_REAL_DIFFERENCE_BPS, timingSum } from "./grade";

const PRICE = 100_000_000_000n; // $1,000.00

describe("gradeDecision", () => {
  it("a buy the price then rose past was a good call; a buy the price then fell under was a worse one", () => {
    const up = gradeDecision({ outcome: "acted", side: "buy", priceThenE8: PRICE, priceLaterE8: 102_000_000_000n });
    expect(up.verdict).toBe("better");
    expect(up.differenceBps).toBe(196); // (1020 − 1000) / 1020
    expect(up.why).toBe("Acting then came out better than waiting a day.");
    const down = gradeDecision({ outcome: "acted", side: "buy", priceThenE8: PRICE, priceLaterE8: 98_000_000_000n });
    expect(down.verdict).toBe("worse");
    expect(down.differenceBps).toBe(-204);
    expect(down.why).toBe("Waiting a day would have come out better.");
  });

  it("waiting is graded against acting then, with the sign flipped", () => {
    const waited = gradeDecision({ outcome: "waited", side: "buy", priceThenE8: PRICE, priceLaterE8: 98_000_000_000n });
    expect(waited.verdict).toBe("better");
    expect(waited.differenceBps).toBe(204);
    expect(waited.chosen).toBe("waiting a day");
    const sell = gradeDecision({ outcome: "declined", side: "sell", priceThenE8: PRICE, priceLaterE8: 103_000_000_000n });
    expect(sell.verdict).toBe("better");
  });

  it("under 25 bps is no real difference, neutral both ways", () => {
    const close = gradeDecision({ outcome: "acted", side: "sell", priceThenE8: PRICE, priceLaterE8: 100_200_000_000n });
    expect(Math.abs(close.differenceBps!)).toBeLessThan(NO_REAL_DIFFERENCE_BPS);
    expect(close.verdict).toBe("no_real_difference");
    expect(close.countsForTiming).toBe(true);
  });

  it("an override is graded but left out of the timing sum; no alternative or no price is ungradable", () => {
    const override = gradeDecision({ outcome: "acted_by_override", side: "buy", priceThenE8: PRICE, priceLaterE8: 102_000_000_000n });
    expect(override.verdict).toBe("better");
    expect(override.countsForTiming).toBe(false);
    expect(gradeDecision({ outcome: "nothing_to_do", side: undefined, priceThenE8: undefined, priceLaterE8: undefined }).verdict).toBe("ungradable");
    expect(gradeDecision({ outcome: "acted", side: "buy", priceThenE8: PRICE, priceLaterE8: undefined }).verdict).toBe("ungradable");
    expect(gradeDecision({ outcome: "acted", side: "buy", priceThenE8: 0n, priceLaterE8: PRICE }).verdict).toBe("ungradable");
    expect(timingSum([override, gradeDecision({ outcome: "waited", side: "buy", priceThenE8: PRICE, priceLaterE8: 98_000_000_000n })])).toEqual({ bps: 204, graded: 1 });
  });
});
