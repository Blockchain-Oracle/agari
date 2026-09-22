import { describe, expect, it } from "vitest";
import { plainHeadline, planOutcome, sizedAmount } from "./plan";
import { checkDeskTiming, deskTimingSchema, quotesPrivateText, styleWordsUsed, type DeskTiming } from "./timing";

const good: DeskTiming = {
  option: "WAIT",
  partPercent: null,
  headline: "Wait, because OpenAI is 15.1% above its mark and your ceiling is 10%.",
  confidencePercent: 72,
  reasons: [{ text: "The premium is above the ceiling.", evidenceIds: ["e2"] }],
  rejected: [
    { option: "ACT_NOW", reason: "The program would refuse the premium." },
    { option: "DECLINE", reason: "The drift is real and may be worth correcting later." },
  ],
  premiumRead: "rich",
  waitFor: "the premium to narrow under 10%",
  warnings: [],
  ruleIds: [],
};
const ids = ["e1", "e2", "e3", "e4", "e5", "e6", "e7"];

describe("the timing schema is strict", () => {
  it("accepts the one shape and refuses extras, missing fields and invented part sizes", () => {
    expect(deskTimingSchema.safeParse(good).success).toBe(true);
    expect(deskTimingSchema.safeParse({ ...good, extra: 1 }).success).toBe(false);
    const { waitFor: _w, ...missing } = good;
    expect(deskTimingSchema.safeParse(missing).success).toBe(false);
    expect(deskTimingSchema.safeParse({ ...good, option: "ACT_PART", partPercent: 30 }).success).toBe(false);
    expect(deskTimingSchema.safeParse({ ...good, option: "ACT_PART", partPercent: 50 }).success).toBe(true);
    expect(deskTimingSchema.safeParse({ ...good, confidencePercent: 101 }).success).toBe(false);
  });
});

describe("checkDeskTiming", () => {
  it("passes a sound answer", () => {
    expect(checkDeskTiming(good, ids, [])).toEqual([]);
  });

  it("names every problem: part sizes, cited ids, self-rejection, a wait with nothing to wait for", () => {
    expect(checkDeskTiming({ ...good, option: "ACT_PART", partPercent: null }, ids, [])).toContain("ACT_PART without a part size");
    expect(checkDeskTiming({ ...good, partPercent: 25 }, ids, [])).toContain("part size given for WAIT");
    expect(checkDeskTiming({ ...good, waitFor: null }, ids, [])).toContain("WAIT without saying what it waits for");
    expect(checkDeskTiming({ ...good, reasons: [{ text: "x", evidenceIds: ["e9"] }] }, ids, [])).toContain('cites unknown evidence id "e9"');
    expect(checkDeskTiming({ ...good, reasons: [{ text: "x", evidenceIds: [] }] }, ids, [])).toContain("a reason cites no evidence");
    expect(checkDeskTiming({ ...good, ruleIds: ["r3"] }, ids, ["r1"])).toContain('cites unknown rule id "r3"');
    expect(checkDeskTiming({ ...good, rejected: [{ option: "WAIT", reason: "x" }] }, ids, [])).toContain("the chosen option also appears as rejected");
  });

  it("fails closed on a hard banned word anywhere in the prose, and only notes a style word", () => {
    const promise = { ...good, warnings: ["This is a guaranteed gain."] };
    expect(checkDeskTiming(promise, ids, [])[0]).toContain("guaranteed");
    const share = { ...good, headline: "Wait, because buying shares of OpenAI now is rich." };
    expect(checkDeskTiming(share, ids, [])[0]).toContain("shares of");
    const styled = { ...good, reasons: [{ text: "There is no signal in the gap.", evidenceIds: ["e2"] }] };
    expect(checkDeskTiming(styled, ids, [])).toEqual([]);
    expect(styleWordsUsed(styled)).toEqual(["signal"]);
  });

  it("refuses an answer that repeats the owner's private notes", () => {
    const notes = "Never buy anything on a Sunday afternoon when I am away.";
    expect(quotesPrivateText({ ...good, warnings: ["The owner said never buy anything on a Sunday afternoon."] }, [notes])).toBe(true);
    expect(quotesPrivateText(good, [notes])).toBe(false);
  });
});

describe("plan", () => {
  const allow = { result: "allow" as const, reasons: [], countedE6: 50_000_000n, oracleValueE6: 0n, oracleFloor: 1n, minOut: 1n, premiumOk: true };
  const deny = { ...allow, result: "deny" as const, reasons: ["over the per-action limit"] };
  const act: DeskTiming = { ...good, option: "ACT_NOW", waitFor: null, rejected: [] };

  it("sizes a part and turns the answer into an outcome by mode, with the gate last and final", () => {
    expect(sizedAmount(100n, { ...act, option: "ACT_PART", partPercent: 25 }, null)).toBe(25n);
    expect(sizedAmount(100n, act, null)).toBe(100n);
    expect(planOutcome({ decision: act, gate: deny, override: null, isPart: false, mode: "on_its_own", largeActionE6: 100_000_000n })).toEqual({ willAct: false, outcome: "BLOCKED_BY_LIMIT", ask: null });
    expect(planOutcome({ decision: act, gate: allow, override: null, isPart: false, mode: "practice", largeActionE6: 100_000_000n }).outcome).toBe("WOULD_HAVE_ACTED");
    expect(planOutcome({ decision: act, gate: allow, override: null, isPart: false, mode: "ask_first", largeActionE6: 100_000_000n })).toEqual({ willAct: false, outcome: "ASKED", ask: "ask_first" });
    expect(planOutcome({ decision: act, gate: allow, override: null, isPart: false, mode: "on_its_own", largeActionE6: 50_000_000n })).toEqual({ willAct: false, outcome: "ASKED", ask: "large_action" });
    expect(planOutcome({ decision: act, gate: allow, override: null, isPart: true, mode: "on_its_own", largeActionE6: 100_000_000n })).toEqual({ willAct: true, outcome: "ACTED_IN_PART", ask: null });
    expect(planOutcome({ decision: good, gate: allow, override: null, isPart: false, mode: "on_its_own", largeActionE6: 100_000_000n }).outcome).toBe("WAITED");
    expect(planOutcome({ decision: undefined, gate: allow, override: null, isPart: false, mode: "on_its_own", largeActionE6: 100_000_000n }).outcome).toBe("FAILED_NO_DECISION");
    expect(planOutcome({ decision: good, gate: allow, override: { by: "owner", reason: "do it" }, isPart: false, mode: "on_its_own", largeActionE6: 100_000_000n }).outcome).toBe("ACTED_BY_OVERRIDE");
  });

  it("turns a leaked code name into plain words for the summary only", () => {
    expect(plainHeadline({ ...good, headline: "WAIT because the premium is rich." })).toBe("Wait because the premium is rich.");
    expect(plainHeadline(undefined)).toBeUndefined();
  });
});
