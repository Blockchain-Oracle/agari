import { describe, expect, it } from "vitest";
import { relayStageLabel } from "./relay-health";

describe("X operational evidence", () => {
  it("does not equate missing or stale evidence with a functioning provider", () => {
    expect(relayStageLabel(null, 200_000)).toBe("Not verified");
    expect(relayStageLabel({ state: "ok", checkedAtMs: 0, succeededAtMs: 0 }, 200_000)).toBe("Status out of date");
    expect(relayStageLabel({ state: "error", checkedAtMs: 200_000, succeededAtMs: 199_999 }, 200_000)).toBe("Needs attention");
    expect(relayStageLabel({ state: "disabled", checkedAtMs: 200_000, succeededAtMs: null }, 200_000)).toBe("Disabled");
  });
});
