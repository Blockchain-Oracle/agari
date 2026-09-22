import { describe, expect, it } from "vitest";
import { DEFERRAL_MAX_SEC, whyDeferralEnds, type DeferralBaseline, type DeferralNow } from "./deferral";
import { MIN_TRADE_E6 } from "./needs";

const baseline: DeferralBaseline = { kind: "wait", decisionSeq: 4, decidedAtSec: 1_790_000_000, premiumBps: 1510, spotE8: "115518656774", driftBps: -900, cashE6: "200000000" };
const now = (over: Partial<DeferralNow> = {}): DeferralNow => ({ atSec: baseline.decidedAtSec + 3600, premiumBps: 1520, spotE8: 115_600_000_000n, driftBps: -910, cashE6: 200_000_000n, ...over });

describe("a remembered wait", () => {
  it("still stands an hour later when nothing measurable changed", () => {
    expect(whyDeferralEnds(baseline, now(), 500)).toBeNull();
  });

  it("ends after a day", () => {
    expect(whyDeferralEnds(baseline, now({ atSec: baseline.decidedAtSec + DEFERRAL_MAX_SEC }), 500)?.status).toBe("revisited");
  });

  it("breaks when at least one USDC of new cash arrives", () => {
    expect(whyDeferralEnds(baseline, now({ cashE6: 200_000_000n + MIN_TRADE_E6 }), 500)?.reason).toContain("cash");
    expect(whyDeferralEnds(baseline, now({ cashE6: 200_000_000n + MIN_TRADE_E6 - 1n }), 500)).toBeNull();
  });

  it("breaks when the premium moves 100 bps, the spot moves 200 bps, or the drift grows half the tolerance", () => {
    expect(whyDeferralEnds(baseline, now({ premiumBps: 1410 }), 500)?.reason).toContain("premium moved by 100");
    expect(whyDeferralEnds(baseline, now({ spotE8: 117_900_000_000n }), 500)?.reason).toContain("price moved");
    expect(whyDeferralEnds(baseline, now({ driftBps: -1150 }), 500)?.reason).toContain("drifted a further 250");
    expect(whyDeferralEnds(baseline, now({ driftBps: -1149 }), 500)).toBeNull();
  });

  it("a premium that cannot be measured now does not end a wait on its own", () => {
    expect(whyDeferralEnds(baseline, now({ premiumBps: null }), 500)).toBeNull();
  });

  it("a practice 'would have' only ends on cash or a day, never on the price", () => {
    const wouldHave: DeferralBaseline = { ...baseline, kind: "would_have" };
    expect(whyDeferralEnds(wouldHave, now({ premiumBps: 0, spotE8: 200_000_000_000n, driftBps: -3000 }), 500)).toBeNull();
    expect(whyDeferralEnds(wouldHave, now({ cashE6: 300_000_000n }), 500)?.status).toBe("broken");
  });
});
