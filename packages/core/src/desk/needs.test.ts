import { describe, expect, it } from "vitest";
import { findNeeds, MIN_TRADE_E6, thresholdBps } from "./needs";
import { presetMandate } from "./presets";
import { valueE6 } from "./units";
import { valueDesk, type DeskHoldingInput } from "./valuation";

const mandate = presetMandate("ailabs")!; // 40% OpenAI · 40% Anthropic · 20% cash
const OPENAI: Omit<DeskHoldingInput, "raw"> = { symbol: "OPENAI", mint: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF", multiplierE12: 1_486_134_700_000n, priceE8: 115_518_656_774n, spotE8: 115_600_000_000n, markE8: 100_300_000_000n, paused: false, frozen: false };
const ANTHROPIC: Omit<DeskHoldingInput, "raw"> = { symbol: "ANTHROPIC", mint: "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw", multiplierE12: 1_000_000_000_000n, priceE8: 104_642_768_409n, spotE8: 104_642_768_409n, markE8: 103_000_000_000n, paused: false, frozen: false };

const holding = (base: Omit<DeskHoldingInput, "raw">, raw: bigint, over: Partial<DeskHoldingInput> = {}): DeskHoldingInput => ({ ...base, raw, ...over });
const value = (cashE6: bigint, holdings: DeskHoldingInput[]) => valueDesk({ atSec: 1_790_000_000, cashE6, holdings, targets: mandate.targets });

describe("the drift threshold", () => {
  it("is 550 bps by cost arithmetic unless the owner's tolerance is wider", () => {
    expect(thresholdBps({ driftToleranceBps: 300 })).toBe(550);
    expect(thresholdBps({ driftToleranceBps: 500 })).toBe(550);
    expect(thresholdBps({ driftToleranceBps: 800 })).toBe(800);
  });
});

describe("findNeeds", () => {
  it("proposes nothing when every holding is within its range", () => {
    // $400 of each name and $200 cash: exactly on target.
    const raw = (h: Omit<DeskHoldingInput, "raw">) => (400_000_000n * 10n ** 23n) / (h.multiplierE12 * (h.priceE8 as bigint));
    const v = value(200_000_000n, [holding(OPENAI, raw(OPENAI)), holding(ANTHROPIC, raw(ANTHROPIC))]);
    expect(Math.abs(v.holdings[0]!.driftBps)).toBeLessThan(5);
    expect(findNeeds(v, mandate, 50_000_000n)).toEqual([]);
  });

  it("buys the under-weight name up to the per-action cap, never below the cash target, and says why", () => {
    // $1,000 cash, nothing held: both names 40% under target. The cap ($50) and the cash floor (20% of $1,000) both apply.
    const v = value(1_000_000_000n, [holding(OPENAI, 0n), holding(ANTHROPIC, 0n)]);
    const needs = findNeeds(v, mandate, 50_000_000n);
    expect(needs).toHaveLength(2);
    for (const n of needs) {
      expect(n.candidate.side).toBe("buy");
      expect(n.candidate.amountIn).toBe(50_000_000n);
      expect(n.limitedByPerAction).toBe(true);
      expect(n.thresholdBps).toBe(550);
      expect(n.candidate.why).toContain("target of 40.0%");
    }
    expect(needs.map((n) => n.candidate.id)).toEqual(["c1", "c2"]);
  });

  it("the cash floor caps a buy: with $250 cash in a $1,000 desk only $50 is spendable", () => {
    const openaiRaw = (750_000_000n * 10n ** 23n) / (OPENAI.multiplierE12 * (OPENAI.priceE8 as bigint));
    const v = value(250_000_000n, [holding(OPENAI, openaiRaw), holding(ANTHROPIC, 0n)]);
    const needs = findNeeds(v, mandate, 500_000_000n);
    const buy = needs.find((n) => n.candidate.side === "buy")!;
    expect(buy.candidate.symbol).toBe("ANTHROPIC");
    expect(buy.candidate.amountIn).toBe(50_000_000n);
  });

  it("sells first, sized with headroom against the highest price the program may count", () => {
    // OpenAI is 75% of the desk against a 40% target: a sell, cut to the cap with 2% headroom at the higher spot.
    const openaiRaw = (750_000_000n * 10n ** 23n) / (OPENAI.multiplierE12 * (OPENAI.priceE8 as bigint));
    const v = value(250_000_000n, [holding(OPENAI, openaiRaw), holding(ANTHROPIC, 0n)]);
    const needs = findNeeds(v, mandate, 100_000_000n);
    expect(needs[0]!.candidate.side).toBe("sell");
    const sell = needs[0]!.candidate;
    expect(sell.symbol).toBe("OPENAI");
    // The mandate's own $50 cap binds (the smaller of the chain's $100 and the owner's): worth ≤ 98% of $50 at the spot.
    expect(valueE6(sell.amountIn, OPENAI.multiplierE12, OPENAI.spotE8 as bigint)).toBeLessThanOrEqual(49_000_000n);
    expect(valueE6(sell.amountIn, OPENAI.multiplierE12, OPENAI.spotE8 as bigint)).toBeGreaterThan(48_500_000n);
    expect(needs[0]!.limitedByPerAction).toBe(true);
  });

  it("sells the whole balance of a name the mandate dropped, whatever its drift", () => {
    const dust = 100_000n; // 0.0001 raw tokens: about 17 cents of OpenAI
    const v = valueDesk({ atSec: 0, cashE6: 1_000_000_000n, holdings: [holding(OPENAI, dust)], targets: { cashBps: 10_000, tokens: [] } });
    const needs = findNeeds(v, { ...mandate, targets: { cashBps: 10_000, tokens: [] } }, 50_000_000n);
    // Below MIN_TRADE it is not worth a network fee: nothing proposed.
    expect(needs).toEqual([]);
    const held = (30_000_000n * 10n ** 23n) / (OPENAI.multiplierE12 * (OPENAI.priceE8 as bigint));
    const v2 = valueDesk({ atSec: 0, cashE6: 1_000_000_000n, holdings: [holding(OPENAI, held)], targets: { cashBps: 10_000, tokens: [] } });
    const needs2 = findNeeds(v2, { ...mandate, targets: { cashBps: 10_000, tokens: [] } }, 50_000_000n);
    expect(needs2).toHaveLength(1);
    expect(needs2[0]!.candidate.amountIn).toBe(held);
    expect(needs2[0]!.candidate.why).toContain("no longer in the mandate");
  });

  it("skips a paused mint or a frozen account, and an unpriced name is never traded", () => {
    const v = value(1_000_000_000n, [holding(OPENAI, 0n, { paused: true }), holding(ANTHROPIC, 0n, { priceE8: null, unpricedWhy: "feed down" })]);
    expect(v.unpriced).toHaveLength(1);
    expect(v.unpriced[0]!.why).toContain("Anthropic");
    expect(findNeeds(v, mandate, 50_000_000n)).toEqual([]);
  });

  it("nothing under one USDC is proposed", () => {
    const v = value(MIN_TRADE_E6 - 1n, [holding(OPENAI, 0n), holding(ANTHROPIC, 0n)]);
    expect(findNeeds(v, mandate, 50_000_000n)).toEqual([]);
  });
});
