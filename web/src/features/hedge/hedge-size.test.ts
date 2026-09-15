import { describe, expect, it } from "vitest";
import { hedgeStakeBase, usdE6ToBase } from "./hedge-size";

const TUSDC = 6;
const ONE = 1_000_000n;

describe("hedge stake preset", () => {
  it("is 10% of the exposure when the balance covers it", () => {
    // 12.5 TSLAx at $359.795 = $4,497.4375 exposure → 449.74375 tUSDC.
    expect(hedgeStakeBase({ exposureUsdE6: 4_497_437_500n, decimals: TUSDC, ticketMaxBase: null, balanceBase: 10_000n * ONE })).toBe(449_743_750n);
  });

  it("never exceeds the ticket max or the balance, whichever is lower", () => {
    const exposureUsdE6 = 4_497_437_500n;
    expect(hedgeStakeBase({ exposureUsdE6, decimals: TUSDC, ticketMaxBase: 25n * ONE, balanceBase: 10_000n * ONE })).toBe(25n * ONE);
    expect(hedgeStakeBase({ exposureUsdE6, decimals: TUSDC, ticketMaxBase: 25n * ONE, balanceBase: 7n * ONE })).toBe(7n * ONE);
  });

  it("presets nothing without a price, a balance, or a stake above zero", () => {
    expect(hedgeStakeBase({ exposureUsdE6: null, decimals: TUSDC, ticketMaxBase: null, balanceBase: ONE })).toBeNull();
    expect(hedgeStakeBase({ exposureUsdE6: 4_497_437_500n, decimals: TUSDC, ticketMaxBase: null, balanceBase: null })).toBeNull();
    expect(hedgeStakeBase({ exposureUsdE6: 4_497_437_500n, decimals: TUSDC, ticketMaxBase: null, balanceBase: 0n })).toBeNull();
    // $0.000009 of exposure floors to zero base units.
    expect(hedgeStakeBase({ exposureUsdE6: 9n, decimals: TUSDC, ticketMaxBase: null, balanceBase: ONE })).toBeNull();
  });

  it("scales to the collateral's decimals by flooring, never rounding up", () => {
    expect(usdE6ToBase(1_999_999n, 2)).toBe(199n);
    expect(usdE6ToBase(1_234_567n, 9)).toBe(1_234_567_000n);
  });
});
