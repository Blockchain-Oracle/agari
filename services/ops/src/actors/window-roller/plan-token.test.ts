import { describe, expect, it } from "vitest";
import type { PlanClock, PlanSeries } from "./plan";
import { planTokenSeries } from "./plan-token";
import type { VersionWindow } from "./versions";

// Sat 2026-09-19 14:00:00Z: a weekend, when only the token lane trades.
const SAT = 1_789_826_400;
const V1: VersionWindow[] = [{ validFromSec: 1_789_430_400, validUntilSec: null, primarySource: 3, checkSource: 0, openAdmissionSec: 60, checkAdmissionSec: 0 }];

const series = (over: Partial<PlanSeries> = {}): PlanSeries => ({
  key: "TSLAx-5m", symbol: "TSLA", cadenceSec: 300, maxLeadSec: 400_000, nextIndex: 4n, lastExpirySec: 0, versions: V1, freeBooks: ["BookA", "BookB"], ...over,
});
const clock = (nowSec: number, over: Partial<PlanClock> = {}): PlanClock => ({
  calendar: null, nowSec, leadSec: 120, gapLeadSec: 172_800, minTradableSec: 60, skips: [], multipliers: [], halts: {}, prelist: true, prelistCadencesSec: [300, 900, 3_600], ...over,
});

describe("window-roller token plan", () => {
  it("lists back-to-back 24/7 without a calendar, Intraday on both boundaries", () => {
    const plan = planTokenSeries(series({ lastExpirySec: SAT }), clock(SAT - 100));
    expect(plan).toMatchObject({ kind: "open", index: 4n, policyVersion: 0, openKind: 0, closeKind: 0, book: "BookA", state: "opening #4 14:00–14:05Z v1 switchboard" });
    expect(planTokenSeries(series({ lastExpirySec: SAT }), clock(SAT - 600))).toMatchObject({ kind: "wait", wakeSec: SAT - 120, state: "waiting: next 14:00–14:05Z" });
  });

  it("after downtime opens the current Window only while its opening print is still admissible (T + 60 − 45 s)", () => {
    const current = planTokenSeries(series({ lastExpirySec: SAT - 3_600 }), clock(SAT + 15));
    expect(current.kind === "open" && current.window.tradingStartSec).toBe(SAT);
    const late = planTokenSeries(series({ lastExpirySec: SAT - 3_600 }), clock(SAT + 16));
    expect(late).toMatchObject({ kind: "wait", wakeSec: SAT + 180 });
    expect(late.kind === "wait" && late.window.tradingStartSec).toBe(SAT + 300);
  });

  it("waits for a Window already listed ahead and aligns 60m to the hour", () => {
    expect(planTokenSeries(series({ lastExpirySec: SAT + 900 }), clock(SAT))).toMatchObject({ kind: "wait", wakeSec: SAT + 780 });
    const hour = planTokenSeries(series({ key: "TSLAx-60m", cadenceSec: 3_600 }), clock(SAT - 1_800));
    expect(hour.kind === "wait" && hour.window.tradingStartSec).toBe(SAT);
  });

  it("pauses on an xStock halt (not the ticker's), a token-lane skip or a multiplier change inside the span; other lanes' skips don't apply", () => {
    const at = clock(SAT - 60);
    expect(planTokenSeries(series(), { ...at, halts: { TSLAx: { reason: "issuer-halt", sinceSec: SAT - 900 } } }).state).toBe("paused: halted (issuer-halt)");
    expect(planTokenSeries(series(), { ...at, halts: { NVDAx: { reason: "quote-unavailable", sinceSec: SAT } } }).kind).toBe("open");
    expect(planTokenSeries(series(), { ...at, halts: { TSLA: { reason: "pyth-stale", sinceSec: SAT } } }).kind).toBe("open");
    const regularOnly = [{ symbol: "TSLA" as const, date: "2026-09-19", why: "split", lanes: ["regular" as const] }];
    expect(planTokenSeries(series(), { ...at, skips: regularOnly }).kind).toBe("open");
    const token = [{ symbol: "TSLA" as const, date: "2026-09-19", why: "split", lanes: ["token" as const] }];
    expect(planTokenSeries(series(), { ...at, skips: token }).state).toBe("paused: corporate action (split)");
    const change = (effectiveSec: number) => [{ xstock: "TSLAx" as const, effectiveSec, from: "1.0", to: "1.0017", why: "multiplier 1.0017" }];
    expect(planTokenSeries(series(), { ...at, multipliers: change(SAT + 300) }).state).toBe("paused: corporate action (multiplier 1.0017)");
    expect(planTokenSeries(series(), { ...at, multipliers: change(SAT) }).kind).toBe("open");
  });

  it("pauses before the version's validity and waits without a free Book", () => {
    expect(planTokenSeries(series(), clock(1_789_430_400 - 60)).state).toBe("paused: no signed source");
    expect(planTokenSeries(series({ freeBooks: [] }), clock(SAT - 60)).state).toBe("waiting: no free book");
  });
});
