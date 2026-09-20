import { describe, expect, it } from "vitest";
import { quoteLeverage, type LeverageQuoteInput } from "./quote";
import type { YesLevel } from "./sizing";
import type { LeverageParams } from "./types";

const ONE = 1_000_000n;
const UNIT = 1_000_000n;
const level = (cents: number, contracts: number): YesLevel => ({ priceRaw: BigInt(cents) * 10_000n, quantityRaw: BigInt(contracts) * ONE });

/** The reserve's launch parameters, as deployed. */
const PARAMS: LeverageParams = {
  maxLeverageBps: 30_000, premiumBps: 800, maintenanceBps: 12_000, maxExposureBps: 6_000,
  minEntryPriceRaw: 50_000n, maxEntryPriceRaw: 950_000n,
  maxFrontedPerPositionBase: 200n * UNIT, maxWindowFrontedBase: 500n * UNIT, maxOpenPositions: 64, minTimeLeftSec: 90,
};

function input(over: Partial<LeverageQuoteInput> = {}): LeverageQuoteInput {
  return {
    side: "up", stakeBase: 10n * UNIT, leverageBps: 20_000,
    entry: [level(51, 100)], exitRested: [level(49, 100)],
    one: ONE, lotRaw: 1_000n, minQuantityRaw: ONE, params: PARAMS,
    books: { liquidBase: 1_000n * UNIT, outstandingBase: 0n, windowFrontedBase: 0n, openPositions: 0 },
    expirySec: 10_000, nowSec: 9_000, decimals: 6, nowMs: 0,
    ...over,
  };
}

const refusalOf = (over: Partial<LeverageQuoteInput>) => {
  const result = quoteLeverage(input(over));
  return result.ok ? "ok" : result.refusal.kind;
};

describe("the boost quote follows owner_open", () => {
  it("a 2x boost on a tight book: the owner's cash plus the front, less the premium, is exactly the cost", () => {
    const result = quoteLeverage(input());
    if (!result.ok) throw new Error(result.refusal.kind);
    const q = result.quote;
    expect(q.stakeBase + q.frontedBase - q.premiumBase).toBe(q.costBase);
    expect(q.stakeBase).toBeLessThanOrEqual(10n * UNIT);
    expect(q.winIfRightBase).toBe(q.quantityRaw - q.frontedBase);
    expect(q.limitYesRaw).toBe(510_000n);
    expect(q.lineBase).toBe((q.frontedBase * 12_000n) / 10_000n);
  });

  it("a Down boost is priced in its own terms and sends its limit in YES terms", () => {
    const result = quoteLeverage(input({ side: "down", entry: [level(49, 100)], exitRested: [level(51, 100)] }));
    if (!result.ok) throw new Error(result.refusal.kind);
    expect(result.quote.priceRaw).toBe(510_000n);
    expect(result.quote.limitYesRaw).toBe(490_000n);
  });

  it("refuses what the program refuses, for the program's reason", () => {
    expect(refusalOf({ stakeBase: 0n })).toBe("zero");
    expect(refusalOf({ leverageBps: 10_000 })).toBe("bad-leverage");
    expect(refusalOf({ leverageBps: 30_001 })).toBe("bad-leverage");
    expect(refusalOf({ nowSec: 9_950 })).toBe("too-late");
    expect(refusalOf({ entry: [] })).toBe("below-min");
    expect(refusalOf({ entry: [level(97, 100)], exitRested: [level(96, 100)] })).toBe("outside-band");
    expect(refusalOf({ books: { liquidBase: 1n * UNIT, outstandingBase: 0n, windowFrontedBase: 0n, openPositions: 0 } })).toBe("liquidity");
    expect(refusalOf({ books: { liquidBase: 1_000n * UNIT, outstandingBase: 0n, windowFrontedBase: 495n * UNIT, openPositions: 0 } })).toBe("window-cap");
    expect(refusalOf({ books: { liquidBase: 1_000n * UNIT, outstandingBase: 0n, windowFrontedBase: 0n, openPositions: 64 } })).toBe("too-many-open");
    expect(refusalOf({ books: { liquidBase: 12n * UNIT, outstandingBase: 0n, windowFrontedBase: 0n, openPositions: 0 } })).toBe("exposure");
    expect(refusalOf({ stakeBase: 150n * UNIT, leverageBps: 30_000, entry: [level(51, 2_000)], exitRested: [level(49, 2_000)] })).toBe("position-cap");
  });

  it("refuses a position that could not be sold whole into rested depth", () => {
    expect(refusalOf({ exitRested: [level(49, 5)] })).toBe("thin-exit");
  });

  it("refuses a position born under its line: 3x into a book whose bid is far under its ask", () => {
    expect(refusalOf({ leverageBps: 30_000, entry: [level(60, 100)], exitRested: [level(40, 100)] })).toBe("unhealthy");
    expect(refusalOf({ leverageBps: 30_000, entry: [level(51, 100)], exitRested: [level(49, 100)] })).toBe("ok");
  });
});
