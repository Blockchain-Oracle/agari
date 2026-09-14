import { describe, expect, it } from "vitest";
import { fairYesTicks, normalCdf } from "./fair";
import { askEscrowPerLot, bidEscrowPerLot, makerPhase, needsRequote, quoteExpirySec, quotePair, sizeLots } from "./quote";

const E8 = 100_000_000n;

describe("fairYesTicks", () => {
  const base = { openE8: 400n * E8, secondsLeft: 150, sigmaBps: 4_500, minTick: 20 };

  it("quotes an unmoved price just above even (ties go Up)", () => {
    expect(fairYesTicks({ ...base, spotE8: 400n * E8 })).toBe(501);
  });

  it("moves with spot vs open and saturates at the clamp", () => {
    const up = fairYesTicks({ ...base, spotE8: 401n * E8 });
    const down = fairYesTicks({ ...base, spotE8: 399n * E8 });
    expect(up).toBeGreaterThan(600);
    expect(down).toBeLessThan(400);
    expect(up + down).toBeGreaterThanOrEqual(1000);
    expect(fairYesTicks({ ...base, spotE8: 440n * E8 })).toBe(980);
    expect(fairYesTicks({ ...base, spotE8: 360n * E8 })).toBe(20);
  });

  it("is an integer inside the clamp and less certain with more time left", () => {
    const soon = fairYesTicks({ ...base, spotE8: 401n * E8, secondsLeft: 30 });
    const later = fairYesTicks({ ...base, spotE8: 401n * E8, secondsLeft: 3_000 });
    expect(Number.isInteger(soon)).toBe(true);
    expect(soon).toBeGreaterThan(later);
  });

  it("uses a normal CDF", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });
});

describe("quotePair and escrow", () => {
  it("brackets the fair by the half spread", () => {
    expect(quotePair({ fairTicks: 540, halfSpreadTicks: 30, minTick: 20, bestBidTicks: null, bestAskTicks: null })).toEqual({ bidTicks: 510, askTicks: 570 });
  });

  it("stays strictly inside the opposite best so PostOnly cannot cross", () => {
    expect(quotePair({ fairTicks: 540, halfSpreadTicks: 30, minTick: 20, bestBidTicks: 580, bestAskTicks: 500 })).toEqual({ bidTicks: 499, askTicks: 581 });
  });

  it("drops a side outside [minTick, 1000 − minTick]", () => {
    expect(quotePair({ fairTicks: 975, halfSpreadTicks: 30, minTick: 20, bestBidTicks: null, bestAskTicks: null })).toEqual({ bidTicks: 945, askTicks: null });
    expect(quotePair({ fairTicks: 25, halfSpreadTicks: 30, minTick: 20, bestBidTicks: null, bestAskTicks: null })).toEqual({ bidTicks: null, askTicks: 55 });
  });

  it("escrows the YES price for a bid and the NO price (1000 − ask) for the NO-side ask", () => {
    expect(bidEscrowPerLot(510, 1n)).toBe(510n);
    expect(askEscrowPerLot(570, 1n)).toBe(430n);
    // 5,000 lots each side: 2.55 + 2.15 tUSDC.
    expect(5_000n * (bidEscrowPerLot(510, 1n) + askEscrowPerLot(570, 1n))).toBe(4_700_000n);
  });

  it("sizes both sides inside the Window budget and respects min lots", () => {
    const pair = { bidTicks: 510, askTicks: 570 };
    expect(sizeLots({ wantLots: 5_000n, pair, cu: 1n, budget: 50_000_000n, minLots: 1_000n })).toBe(5_000n);
    expect(sizeLots({ wantLots: 5_000n, pair, cu: 1n, budget: 1_880_000n, minLots: 1_000n })).toBe(2_000n);
    expect(sizeLots({ wantLots: 5_000n, pair, cu: 1n, budget: 900_000n, minLots: 1_000n })).toBe(0n);
  });
});

describe("timing", () => {
  it("expires at min(now + TTL, lock − 30)", () => {
    expect(quoteExpirySec(1_000, 2_000, 120)).toBe(1_120);
    expect(quoteExpirySec(1_900, 2_000, 120)).toBe(1_970);
  });

  it("requotes on a fair move of requoteTicks, near expiry, or with nothing placed", () => {
    const placed = { fairTicks: 540, expireSec: 1_120 };
    expect(needsRequote({ placed: null, fairTicks: 540, nowSec: 1_000, requoteTicks: 10 })).toBe(true);
    expect(needsRequote({ placed, fairTicks: 549, nowSec: 1_000, requoteTicks: 10 })).toBe(false);
    expect(needsRequote({ placed, fairTicks: 550, nowSec: 1_000, requoteTicks: 10 })).toBe(true);
    expect(needsRequote({ placed, fairTicks: 540, nowSec: 1_100, requoteTicks: 10 })).toBe(true);
  });

  it("stops 60 s before lock and pulls near the close, out of session or on stale spot", () => {
    const base = { nowSec: 1_000, lockAtSec: 1_100, inSession: true, closesAtSec: 5_000, spotFresh: true };
    expect(makerPhase(base)).toBe("quote");
    expect(makerPhase({ ...base, nowSec: 1_040 })).toBe("stop");
    expect(makerPhase({ ...base, closesAtSec: 1_120 })).toBe("pull");
    expect(makerPhase({ ...base, inSession: false })).toBe("pull");
    expect(makerPhase({ ...base, spotFresh: false })).toBe("pull");
  });
});
