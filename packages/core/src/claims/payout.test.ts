import { describe, expect, it } from "vitest";
import { enumerateClaimables, type SettledMarket } from "./enumerate";
import { estPayoutBase } from "./payout";
import { testAddress, testMarketId } from "../testing/ids";

const market: SettledMarket = {
  marketId: testMarketId(1),
  marketAddress: testAddress(2),
  asset: "TSLA",
  intervalSec: 300,
  expirySec: 1_000,
  decimals: 6,
  voided: false,
  winningOutcome: 0,
  resolvedAtMs: null,
};

describe("estPayoutBase", () => {
  it("mirrors user_redeem on the spec's worked numbers: 4,000 lots × 1,000 base units", () => {
    expect(estPayoutBase(4_000_000n, "win")).toBe(4_000_000n);
    expect(estPayoutBase(4_000_000n, "void")).toBe(2_000_000n);
  });

  it("floors once, never charges a fee", () => {
    expect(estPayoutBase(1_000_001n, "win")).toBe(1_000_001n);
    expect(estPayoutBase(1_001n, "void")).toBe(500n);
  });
});

describe("enumerateClaimables", () => {
  it("never rows a losing side and rows a void once with both legs", () => {
    const loss = enumerateClaimables([{ market, holdings: { upRaw: 0n, downRaw: 5n }, feeBps: 0 }]);
    expect(loss).toEqual([]);

    const voided = enumerateClaimables([{ market: { ...market, voided: true, winningOutcome: null }, holdings: { upRaw: 4n, downRaw: 2n }, feeBps: 250 }]);
    expect(voided).toHaveLength(1);
    expect(voided[0]?.legs.map((leg) => leg.payoutBase)).toEqual([2n, 1n]);
    expect(voided[0]?.netPayoutBase).toBe(3n);
  });
});
