import { describe, expect, it } from "vitest";
import { decimalToE12, effectiveMultiplierE12, exposureUsdE6, MULTIPLIER_SCALE, sharesE8 } from "./scaled-amount";

describe("ScaledUiAmount in integers", () => {
  it("floors a 16-place multiplier to 12 places without a float", () => {
    expect(decimalToE12("1.0017152487959897")).toBe(1_001_715_248_795n);
    expect(decimalToE12("1")).toBe(MULTIPLIER_SCALE);
    expect(decimalToE12("0.5")).toBe(500_000_000_000n);
    expect(decimalToE12("1e-5")).toBeNull();
    expect(decimalToE12("-1")).toBeNull();
  });

  it("switches to the scheduled multiplier at its timestamp (NVDAx, mainnet 2026-09-15)", () => {
    const state = { multiplier: "1.0009180758490996", newMultiplier: "1.001701196801074", newMultiplierEffectiveTimestamp: 1_789_000_200 };
    expect(effectiveMultiplierE12(state, 1_789_000_199)).toBe(1_000_918_075_849n);
    expect(effectiveMultiplierE12(state, 1_789_000_200)).toBe(1_001_701_196_801n);
    expect(effectiveMultiplierE12(null, 0)).toBe(MULTIPLIER_SCALE);
  });

  it("turns a raw balance into shares and USD exposure", () => {
    // 12.5 TSLAx at 8 dp, multiplier 1, TSLA $359.795 → $4,497.4375.
    const shares = sharesE8(1_250_000_000n, 8, MULTIPLIER_SCALE);
    expect(shares).toBe(1_250_000_000n);
    expect(exposureUsdE6(shares, 35_979_500_000n)).toBe(4_497_437_500n);
    // 3 NVDAon at 9 dp with the 1.0017152487959897 multiplier: 3.005145746385 shares, floored at 8 dp.
    expect(sharesE8(3_000_000_000n, 9, 1_001_715_248_795n)).toBe(300_514_574n);
  });
});
