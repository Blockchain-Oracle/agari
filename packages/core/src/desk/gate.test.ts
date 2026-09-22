import { describe, expect, it } from "vitest";
import { BAND_BPS, BAND_KEEP_DEN, BAND_KEEP_NUM, buyFloor, gate, premiumOk, sellFloor, sellOracleValue, type DeskGateInput } from "./gate";
import golden from "./gate.vectors.json";
import { BPS, VALUE_SCALE } from "./units";

type Vector = (typeof golden)["vectors"][number];

function inputOf(v: Vector): DeskGateInput {
  return {
    side: v.side as DeskGateInput["side"],
    amountIn: BigInt(v.amountIn),
    quoteOut: BigInt(v.quoteOut),
    tokenPriceE8: BigInt(v.tokenPriceE8),
    multiplierE12: BigInt(v.multiplierE12),
    referenceE8: v.referenceE8 === null ? null : BigInt(v.referenceE8),
    maxPremiumBps: v.maxPremiumBps,
    slippageBps: BigInt(v.slippageBps),
    mandate: v.mandate ? { perActionCapE6: BigInt(v.mandate.perActionCapE6), dailyCapE6: BigInt(v.mandate.dailyCapE6), spentTodayE6: BigInt(v.mandate.spentTodayE6) } : null,
    desk: { ...v.desk, perActionCapE6: BigInt(v.desk.perActionCapE6), remainingDailyCapE6: BigInt(v.desk.remainingDailyCapE6), cashE6: BigInt(v.desk.cashE6), tokenBalanceRaw: BigInt(v.desk.tokenBalanceRaw) },
    gapBps: v.gapBps,
    costBps: v.costBps,
    protective: v.protective,
    position: v.position ? { holdingE6: BigInt(v.position.holdingE6), totalE6: BigInt(v.position.totalE6), maxPositionBps: v.position.maxPositionBps } : null,
  };
}

describe("the limits check mirrors guard.rs (gate.vectors.json)", () => {
  it("has the count it says", () => {
    expect(golden.vectors).toHaveLength(golden.count);
    expect(golden.count).toBeGreaterThanOrEqual(20);
  });

  for (const v of golden.vectors) {
    it(v.name, () => {
      const r = gate(inputOf(v));
      expect(r.result).toBe(v.expect.result);
      expect(r.reasons).toEqual(v.expect.reasons);
      expect(r.countedE6.toString()).toBe(v.expect.countedE6);
      expect(r.oracleValueE6.toString()).toBe(v.expect.oracleValueE6);
      expect(r.oracleFloor.toString()).toBe(v.expect.oracleFloor);
      expect(r.minOut.toString()).toBe(v.expect.minOut);
      expect(r.premiumOk).toBe(v.expect.premiumOk);
    });
  }
});

describe("the program's integer maths, by hand", () => {
  it("92/100 is exactly (10000 − BAND) / 10000", () => {
    expect((BPS - BAND_BPS) / 100n).toBe(BAND_KEEP_NUM);
    expect(BAND_KEEP_DEN).toBe(100n);
  });

  it("buys 50 USDC of a 1046.42768409 token at multiplier 1: 47,781,610 raw, floor 92% of it", () => {
    const full = (50_000_000n * VALUE_SCALE) / (1_000_000_000_000n * 104_642_768_409n);
    expect(full).toBe(47_781_610n);
    expect(buyFloor(50_000_000n, 1_000_000_000_000n, 104_642_768_409n)).toBe(43_959_081n);
  });

  it("values a sell in the program's order of operations, then takes 8% off", () => {
    expect(sellOracleValue(500_000_000n, 1_000_000_000_000n, 104_642_768_409n)).toBe(523_213_842n);
    expect(sellFloor(523_213_842n)).toBe(481_356_734n);
    // OpenAI's multiplier scales the value up: 0.5 raw tokens are 0.743 UI tokens.
    expect(sellOracleValue(500_000_000n, 1_486_134_700_000n, 115_518_656_774n)).toBe(858_381_420n);
  });

  it("the premium inequality is inclusive at the ceiling and refuses without a reference", () => {
    expect(premiumOk(110_000_000_000n, 100_000_000_000n, 1000)).toBe(true);
    expect(premiumOk(110_000_000_001n, 100_000_000_000n, 1000)).toBe(false);
    expect(premiumOk(90_000_000_000n, 100_000_000_000n, 0)).toBe(true);
    expect(premiumOk(1n, null, 1000)).toBe(false);
    expect(premiumOk(1n, 0n, 1000)).toBe(false);
  });
});
