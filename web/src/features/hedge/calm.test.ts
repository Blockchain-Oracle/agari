import { describe, expect, it } from "vitest";
import { bpsPct, CALM_MIN_WINDOW_SEC, CALM_RANGE_BPS, calmSet, isCalm, windowText } from "./calm";

const move = (rangeBps: number, windowSec = 7_200) => ({ windowSec, samples: 100, rangeBps, changeBps: 0 });

describe("calm pre-IPO names", () => {
  it("is calm only under the range threshold with enough window to judge; unknown is never calm", () => {
    expect(isCalm(move(0))).toBe(true);
    expect(isCalm(move(CALM_RANGE_BPS - 1))).toBe(true);
    expect(isCalm(move(CALM_RANGE_BPS))).toBe(false);
    expect(isCalm(move(0, CALM_MIN_WINDOW_SEC - 1))).toBe(false);
    expect(isCalm(null)).toBe(false);
    expect(isCalm(undefined)).toBe(false);
  });
  it("collects the calm names from the facts payload and ignores what it cannot name", () => {
    const set = calmSet({ SPACEX: { move: move(0) }, OPENAI: { move: move(230) }, ANDURIL: { move: null }, BOGUS: { move: move(0) } });
    expect([...set]).toEqual(["SPACEX"]);
    expect(calmSet(null).size).toBe(0);
  });
  it("prints the window and the move in the reader's units", () => {
    expect(windowText(7_188)).toBe("2 h");
    expect(windowText(5_400)).toBe("2 h");
    expect(windowText(2_100)).toBe("35 min");
    expect(bpsPct(230)).toBe("2.3%");
    expect(bpsPct(-5)).toBe("0.1%");
  });
});
