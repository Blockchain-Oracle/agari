import { describe, expect, it } from "vitest";
import { shortBookTotals, shortHealth, shortMarkPriceRaw, shortPnl, shortPriced, shortResult } from "./short";
import type { LeverageMark, LeveragePosition } from "./types";

/**
 * Pinned against the two positions the S10c drive actually opened on devnet (`acceptance.md`, 2026-09-20 15:01
 * and 15:02), so the numbers this surface prints are the ones the chain moved. The arithmetic does not depend on
 * which side was bought, so these keep the side they were recorded with rather than being relabelled `down`.
 */
const base = {
  owner: "EfTzYtM22yPbriCaFaKEK7pMrWoEfmFoqNtp8vDELmgp",
  status: "live",
  side: "up",
  marketId: "BpKpucLR",
  openedAtSec: 0,
  expirySec: 900,
  exitedAtSec: null,
  proceedsBase: 0n,
  reclaimedBase: 0n,
  returnedBase: 0n,
  owedBase: 0n,
} satisfies Partial<LeveragePosition>;

/** Position 1: 2 tUSDC at 2×, bought at 52.0 on a 48.0 / 52.0 book. */
const ONE_X2: LeveragePosition = {
  ...base,
  positionId: 1n,
  leverageBps: 20_000,
  quantityRaw: 7_384_000n,
  stakeBase: 1_999_832n,
  frontedBase: 1_999_834n,
  premiumBase: 159_986n,
  entryPriceRaw: 520_000n,
} as LeveragePosition;

/** Position 2: 3 tUSDC at 3×, sized down to the 12,616 lots left on the ask, knocked out when the bid went to 43.0. */
const TWO_X3: LeveragePosition = {
  ...base,
  positionId: 2n,
  leverageBps: 30_000,
  quantityRaw: 12_616_000n,
  stakeBase: 2_309_971n,
  frontedBase: 4_619_944n,
  premiumBase: 369_595n,
  entryPriceRaw: 520_000n,
} as LeveragePosition;

const mark = (markBase: bigint, lineBase: bigint, filledRaw: bigint, knockable: boolean): LeverageMark => ({ markBase, filledRaw, lineBase, knockable });

describe("a short's readout equals the money the chain moved", () => {
  it("cost is stake + front − premium, the program's own identity", () => {
    expect(ONE_X2.stakeBase + ONE_X2.frontedBase - ONE_X2.premiumBase).toBe(3_839_680n);
    expect(TWO_X3.stakeBase + TWO_X3.frontedBase - TWO_X3.premiumBase).toBe(6_560_320n);
  });

  it("the mark reads back as the price per contract the book was actually showing", () => {
    // Position 1 cashed out into a 48.0 bid for 3,544,320.
    expect(shortMarkPriceRaw(ONE_X2, 3_544_320n)).toBe(480_000n);
    // Position 2 was knocked out after the drive moved the bid to 43.0; the mark is one unit under the sale.
    expect(shortMarkPriceRaw(TWO_X3, 5_424_879n)).toBe(429_999n);
    // At the opening mark a position reads back at exactly the price it paid.
    expect(shortMarkPriceRaw(ONE_X2, 3_839_680n)).toBe(ONE_X2.entryPriceRaw);
  });

  it("equity and P&L are the owner's own figures from the exit", () => {
    const live = shortPnl(ONE_X2, 3_544_320n);
    expect(live.equityBase).toBe(1_544_486n); // paid to the owner by owner_close
    expect(live.pnlBase).toBe(-455_346n); // the 4¢ spread on 7.384 contracts plus the premium
    expect(live.sign).toBe("down");

    const knocked = shortPnl(TWO_X3, 5_424_880n);
    expect(knocked.equityBase).toBe(804_936n); // paid to the owner inside public_knock_out
  });

  it("a finished short reports what came back, not a mark", () => {
    const settled = { ...ONE_X2, status: "closed", returnedBase: 1_544_486n } as LeveragePosition;
    expect(shortResult(settled)).toEqual({ equityBase: 1_544_486n, pnlBase: -455_346n, sign: "down" });
    const lost = { ...TWO_X3, status: "knocked-out", returnedBase: 0n } as LeveragePosition;
    expect(shortResult(lost).pnlBase).toBe(-2_309_971n);
  });
});

describe("the distance to the knock-out line", () => {
  it("names the fall that reaches the line", () => {
    const health = shortHealth(mark(3_544_320n, 2_399_800n, ONE_X2.quantityRaw, false), ONE_X2.frontedBase);
    expect(health.headroomBase).toBe(1_144_520n);
    expect(health.dropToLineBps).toBe(3_229); // a 32.29% fall in the mark reaches the line
    expect(health.band).toBe("clear");
  });

  it("says close when the line is inside 20% of the mark", () => {
    const health = shortHealth(mark(2_600_000n, 2_399_800n, ONE_X2.quantityRaw, false), ONE_X2.frontedBase);
    expect(health.dropToLineBps).toBe(770);
    expect(health.band).toBe("close");
  });

  it("is at the line exactly when the program would let anyone knock it out", () => {
    // The knock-out the keeper actually sent: mark 5,424,879 under the line 5,543,932.
    const health = shortHealth(mark(5_424_879n, 5_543_932n, TWO_X3.quantityRaw, true), TWO_X3.frontedBase);
    expect(health.band).toBe("at-line");
    expect(health.headroomBase).toBe(0n);
  });

  it("a 1× short fronts nothing, so it has no line at all", () => {
    const flat = { ...ONE_X2, leverageBps: 10_000, frontedBase: 0n, premiumBase: 0n } as LeveragePosition;
    const health = shortHealth(mark(1_999_832n, 0n, flat.quantityRaw, false), flat.frontedBase);
    expect(health.band).toBe("unfronted");
    expect(health.dropToLineBps).toBeNull();
  });
});

describe("the book a wallet holds", () => {
  it("counts a position the book cannot take in full, but does not mark it", () => {
    const thin = mark(1_000_000n, 2_399_800n, ONE_X2.quantityRaw - 1n, false);
    expect(shortPriced(ONE_X2, thin)).toBe(false);
    const totals = shortBookTotals([
      { position: ONE_X2, mark: mark(3_544_320n, 2_399_800n, ONE_X2.quantityRaw, false) },
      { position: TWO_X3, mark: thin },
      { position: TWO_X3, mark: null },
    ]);
    expect(totals).toEqual({ live: 3, priced: 1, stakedBase: 1_999_832n, equityBase: 1_544_486n, pnlBase: -455_346n, sign: "down" });
  });
});
