import { describe, expect, it } from "vitest";
import { BASKETS } from "../market/baskets";
import { checkMandate, describeTargets, deskMandateSchema, mandateFromWire, mandateToWire, type DeskMandate } from "./mandate";
import { DEFAULT_LIMITS, DEFAULT_MONEY, DESK_PRESETS, presetById, presetMandate, presetTokens } from "./presets";

describe("presets from the baskets", () => {
  it("scales every basket to the cash sleeve and totals exactly 100%", () => {
    expect(DESK_PRESETS.map((p) => p.id)).toEqual(["ailabs", "frontier", "predmkts", "defspace", "preall"]);
    for (const p of DESK_PRESETS) {
      const total = p.cashBps + p.tokens.reduce((s, t) => s + t.weightBps, 0);
      expect(total).toBe(10_000);
      expect(p.tokens.map((t) => t.symbol)).toEqual(BASKETS[p.basket].members.map((m) => m.symbol));
    }
    // AI Labs at 20% cash: 4,000 / 4,000. All PreStocks at 20% cash: 8,000 over 8 = 1,000 each.
    expect(presetById("ailabs")!.tokens.map((t) => t.weightBps)).toEqual([4000, 4000]);
    expect(presetById("preall")!.tokens.every((t) => t.weightBps === 1000)).toBe(true);
  });

  it("puts the rounding remainder on the largest weight", () => {
    // Frontier at 10% cash: 9,000 over 4 = 2,250 each (exact). At 1,234 bps cash: 8,766 over 4 = 2,191.5 → 2,192 + 3 × 2,191.
    expect(presetTokens("FRONTIER", 1000).map((t) => t.weightBps)).toEqual([2250, 2250, 2250, 2250]);
    const odd = presetTokens("FRONTIER", 1234).map((t) => t.weightBps);
    expect(odd).toEqual([2193, 2191, 2191, 2191]);
    expect(odd.reduce((s, w) => s + w, 0)).toBe(8766);
  });

  it("builds a whole mandate with the defaults, and overrides apply", () => {
    const m = presetMandate("ailabs")!;
    expect(deskMandateSchema.safeParse(m).success).toBe(true);
    expect(checkMandate(m)).toEqual([]);
    expect(m.perActionCapE6).toBe(DEFAULT_MONEY.perActionCapE6);
    expect(m.maxPremiumBps).toBe(DEFAULT_LIMITS.maxPremiumBps);
    const custom = presetMandate("ailabs", { cashBps: 0, notes: "Never buy on a Sunday." })!;
    expect(custom.targets).toEqual({ cashBps: 0, tokens: [{ symbol: "OPENAI", weightBps: 5000 }, { symbol: "ANTHROPIC", weightBps: 5000 }] });
    expect(custom.notes).toBe("Never buy on a Sunday.");
    expect(presetMandate("nope")).toBeNull();
  });
});

describe("checkMandate", () => {
  const base: DeskMandate = presetMandate("ailabs")!;

  it("says what is wrong in plain sentences", () => {
    expect(checkMandate({ ...base, targets: { cashBps: 2000, tokens: [{ symbol: "OPENAI", weightBps: 4000 }, { symbol: "OPENAI", weightBps: 4000 }] } })).toContain("OpenAI is listed twice");
    expect(checkMandate({ ...base, maxPositionBps: 3000 })).toContain("OpenAI has a target of 40.0%, above the largest holding you allow (30.0%)");
    expect(checkMandate({ ...base, targets: { cashBps: 3000, tokens: base.targets.tokens } })).toContain("the targets and cash add up to 110.0%, not 100%");
    expect(checkMandate({ ...base, dailyCapE6: 1n })).toContain("the daily limit is below the per-action limit");
    expect(checkMandate({ ...base, driftToleranceBps: 0 })[0]).toContain("tolerance of zero");
    expect(checkMandate({ ...base, lossStopBps: 0 })[0]).toContain("loss limit of zero");
    expect(checkMandate({ ...base, maxPremiumBps: 0 })[0]).toContain("premium ceiling of zero");
    expect(checkMandate({ ...base, targets: { cashBps: 10_000, tokens: [] } })).toContain("the basket names no company");
  });

  it("describes the targets the way the owner reads them", () => {
    expect(describeTargets(base.targets)).toBe("40.0% OpenAI · 40.0% Anthropic · 20.0% cash");
  });
});

describe("the wire form", () => {
  it("round-trips through integer strings and refuses a decimal point or an unknown symbol", () => {
    const m = presetMandate("defspace")!;
    const wire = mandateToWire(m);
    expect(wire.perActionCapE6).toBe("50000000");
    expect(mandateFromWire(wire)).toEqual(m);
    expect(() => mandateFromWire({ ...wire, dailyCapE6: "150.5" })).toThrow();
    expect(() => mandateFromWire({ ...wire, targets: { cashBps: 2000, tokens: [{ symbol: "TSLA" as never, weightBps: 8000 }] } })).toThrow();
    expect(deskMandateSchema.safeParse({ ...m, extra: true }).success).toBe(false);
  });
});
