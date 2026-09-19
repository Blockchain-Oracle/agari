import { QUOTE_FAILURES_TO_HALT } from "@agari/core/market";
import { beforeEach, describe, expect, it } from "vitest";
import { PROBE_EVERY_SEC, quoteFailureStreak, recordQuoteResult, resetQuoteStreaks, xstocksToProbe } from "./quote-failures";

describe("token-lane quote streaks (D-099)", () => {
  beforeEach(resetQuoteStreaks);

  it("counts consecutive failures per xStock and resets on a fetched quote", () => {
    recordQuoteResult(["TSLAx", "NVDAx"], false, 1_000);
    recordQuoteResult(["TSLAx"], false, 1_010);
    expect(quoteFailureStreak("TSLAx")).toBe(2);
    expect(quoteFailureStreak("NVDAx")).toBe(1);
    expect(quoteFailureStreak("SPYx")).toBe(0);
    recordQuoteResult(["TSLAx"], true, 1_020);
    expect(quoteFailureStreak("TSLAx")).toBe(0);
  });

  it("asks for a probe only once a streak reaches the halt threshold and a probe cadence has passed since the last attempt", () => {
    for (let i = 0; i < QUOTE_FAILURES_TO_HALT; i += 1) recordQuoteResult(["TSLAx"], false, 1_000 + i);
    recordQuoteResult(["NVDAx"], false, 1_000); // one failure: not halted, never probed
    expect(xstocksToProbe(1_000 + QUOTE_FAILURES_TO_HALT)).toEqual([]);
    expect(xstocksToProbe(1_000 + QUOTE_FAILURES_TO_HALT - 1 + PROBE_EVERY_SEC - 1)).toEqual([]);
    expect(xstocksToProbe(1_000 + QUOTE_FAILURES_TO_HALT - 1 + PROBE_EVERY_SEC)).toEqual(["TSLAx"]);
    // A failed probe keeps the halt and restarts the cadence; a fetched quote clears the streak so halt-watch can clear the lane.
    recordQuoteResult(["TSLAx"], false, 2_000);
    expect(quoteFailureStreak("TSLAx")).toBe(QUOTE_FAILURES_TO_HALT + 1);
    expect(xstocksToProbe(2_000 + PROBE_EVERY_SEC - 1)).toEqual([]);
    expect(xstocksToProbe(2_000 + PROBE_EVERY_SEC)).toEqual(["TSLAx"]);
    recordQuoteResult(["TSLAx"], true, 2_400);
    expect(quoteFailureStreak("TSLAx")).toBe(0);
    expect(xstocksToProbe(9_999)).toEqual([]);
  });
});
