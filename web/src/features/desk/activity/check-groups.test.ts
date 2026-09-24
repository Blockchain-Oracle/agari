import { describe, expect, it } from "vitest";
import type { RecordSummaryWire } from "../protocol";
import { checkRows, figureParts, groupChecks, splitSummary } from "./check-groups";

const HASH = `0x${"00".repeat(32)}` as const;
const rec = (seq: number, atSec: number, outcome: RecordSummaryWire["outcome"], summary: string): RecordSummaryWire => ({
  seq, prevHash: HASH, recordHash: HASH, outcome, summary, mode: "practice", decidedAtSec: atSec, sealedBySig: null, sealedSeq: null,
});

const T = 1_800_000_000;
const OPENAI = "OpenAI is 29.9% above its mark. Your ceiling is 10.0%.";
const ANTHROPIC = "The price of Anthropic is 1.5% away from its own average of the last half hour. The desk waits for it to settle.";
const QUIET = "Nothing new. The desk would already have bought Anthropic at 23:00 UTC, and nothing measurable has changed since.";

describe("splitSummary", () => {
  it("keeps the fact and folds the reason", () => {
    expect(splitSummary(OPENAI)).toEqual({ lead: "OpenAI is 29.9% above its mark.", rest: "Your ceiling is 10.0%." });
  });
  it("does not split inside a figure", () => {
    expect(splitSummary("I bought $12.50 of OpenAI.")).toEqual({ lead: "I bought $12.50 of OpenAI.", rest: "" });
  });
});

describe("figureParts", () => {
  it("picks out money and percentages", () => {
    expect(figureParts("bought $1,250.00 at 2.5% over").filter((p) => p.figure).map((p) => p.text)).toEqual(["$1,250.00", "2.5%"]);
  });
});

describe("groupChecks", () => {
  it("makes one check of the records a check writes together, and counts a doubled run", () => {
    const groups = groupChecks([rec(6, T + 3_603, "declined", ANTHROPIC), rec(5, T + 3_603, "declined", OPENAI), rec(4, T + 3_600, "declined", OPENAI), rec(3, T, "nothing_to_do", QUIET), rec(2, T, "declined", OPENAI)]);
    expect(groups.map((g) => g.seqs)).toEqual([[6, 5, 4], [3, 2]]);
    expect(groups[0]!.lines.map((l) => [l.symbol, l.repeats])).toEqual([["ANTHROPIC", 1], ["OPENAI", 2]]);
    // The declined line leads the second check over the quiet one.
    expect(groups[1]!.tone).toBe("declined");
    expect(groups[1]!.lines[0]!.symbol).toBe("OPENAI");
  });

  it("folds two or more quiet checks in a row", () => {
    const rows = checkRows(groupChecks([rec(4, T + 7_200, "declined", OPENAI), rec(3, T + 3_600, "nothing_to_do", QUIET), rec(2, T, "waited", QUIET), rec(1, T - 3_600, "declined", OPENAI)]));
    expect(rows.map((r) => r.kind)).toEqual(["check", "quiet", "check"]);
  });
});
