import { describe, expect, it } from "vitest";
import type { PlanClock, PlanSeries } from "./plan";
import { planTokenSeries } from "./plan-token";
import { highestCoveringVersion, noSourceState, PAUSED_NO_SOURCE, PAUSED_NOT_ENTITLED, usableBy, versionWindow, type VersionWindow } from "./versions";

const OPENAI = "96d4bb23a3db78fdb72b3a03ce80ead686096f324319166534d9a27c0519c483";
const T0 = 1_789_430_400;
const pyth = (feed: string, over: Partial<VersionWindow> = {}): VersionWindow => ({ validFromSec: T0, validUntilSec: null, primarySource: 1, checkSource: 0, openAdmissionSec: 900, checkAdmissionSec: 0, primaryFeedIdHex: feed, ...over });
const redstone: VersionWindow = { validFromSec: T0, validUntilSec: null, primarySource: 2, checkSource: 0, openAdmissionSec: 900, checkAdmissionSec: 0, primaryFeedIdHex: "" };

describe("highestCoveringVersion with a usable rule (S20)", () => {
  it("skips a covering Pyth version whose feed is not usable and falls back to an older usable one", () => {
    const versions = [redstone, pyth(OPENAI)];
    expect(highestCoveringVersion(versions, T0 + 60, T0 + 3_660)).toBe(1);
    expect(highestCoveringVersion(versions, T0 + 60, T0 + 3_660, usableBy({ pythUsable: () => false }))).toBe(0);
    expect(highestCoveringVersion(versions, T0 + 60, T0 + 3_660, usableBy({ pythUsable: (hex) => hex === OPENAI }))).toBe(1);
    // A version that does not cover the Window is not rescued by being usable.
    expect(highestCoveringVersion([pyth(OPENAI)], T0 - 100, T0 + 100, usableBy({ pythUsable: () => true }))).toBeNull();
  });

  it("names the honest paused state: not entitled when a covering version exists, no signed source otherwise", () => {
    expect(noSourceState([pyth(OPENAI)], T0 + 60, T0 + 3_660, usableBy({ pythUsable: () => false }))).toBe(PAUSED_NOT_ENTITLED);
    expect(noSourceState([pyth(OPENAI)], T0 - 100, T0 + 100, usableBy({ pythUsable: () => false }))).toBe(PAUSED_NO_SOURCE);
    expect(PAUSED_NOT_ENTITLED).toBe("paused: no signed source (Pyth feed not entitled)");
  });

  it("carries the primary feed as lower-case hex from a decoded version", () => {
    const feedId = Uint8Array.from([0xab, 0xcd, ...new Array(30).fill(0)]);
    const v = versionWindow({ validFromTs: 0n, validUntilTs: 9_223_372_036_854_775_807n, primary: { source: 1, openAdmissionSec: 900, feedId }, check: { source: 0 }, checkAdmissionSec: 0 });
    expect(v.primaryFeedIdHex).toBe(`abcd${"00".repeat(30)}`);
    expect(v.validUntilSec).toBeNull();
  });
});

describe("a valuation lane in the token planner (S20)", () => {
  const SAT = 1_789_826_400;
  const series: PlanSeries = { key: "OPENAIV-60m", symbol: "OPENAIV", cadenceSec: 3_600, maxLeadSec: 400_000, nextIndex: 1n, lastExpirySec: SAT, versions: [pyth(OPENAI)], freeBooks: ["BookA"] };
  const clock = (pythUsable: PlanClock["pythUsable"]): PlanClock => ({
    calendar: null, nowSec: SAT - 60, leadSec: 120, gapLeadSec: 172_800, minTradableSec: 60, skips: [], multipliers: [], halts: {}, prelist: true, prelistCadencesSec: [300, 900, 3_600], pythUsable,
  });
  it("pauses while the index is not entitled and opens once it is, keyed as its own 24/7 asset", () => {
    expect(planTokenSeries(series, clock(() => false))).toMatchObject({ kind: "paused", state: PAUSED_NOT_ENTITLED });
    expect(planTokenSeries(series, clock((hex) => hex === OPENAI))).toMatchObject({ kind: "open", index: 1n, policyVersion: 0, state: "opening #1 14:00–15:00Z v1 pyth" });
    // A halt on the valuation lane itself pauses it; one on the token lane it shadows does not.
    expect(planTokenSeries(series, { ...clock(() => true), halts: { OPENAIV: { reason: "pyth-stale", sinceSec: SAT - 900 } } }).state).toBe("paused: halted (pyth-stale)");
    expect(planTokenSeries(series, { ...clock(() => true), halts: { OPENAI: { reason: "quote-unavailable", sinceSec: SAT - 900 } } }).kind).toBe("open");
  });
});
