import { describe, expect, it } from "vitest";
import { isUnknownLanding, refusalName, refusalTechnical, refusalWords } from "./desk-errors";

const refused = new Error(
  [
    "private mint failed: Failed to send transaction: Transaction failed when it was simulated in order to estimate its resource limits.",
    "  log: Program log: Instruction: DeskMintInSlot",
    "  log: Program log: AnchorError thrown in programs/agari-private/src/instructions/open.rs:121. Error Code: BelowMinQuantity. Error Number: 6022. Error Message: the book fills fewer contracts than the owner's guard.",
    "  log: Program 6qjoqeiGt8K5RoYvsRCDoS4QsDXrsPAZjHwy4vU98d9j failed: custom program error: 0x1786",
  ].join("\n"),
);

describe("what the desk tells an owner about a refused send", () => {
  it("is the program's own words, not the transport's boilerplate (the devnet refund of 2026-09-20)", () => {
    expect(refusalName(refused)).toBe("BelowMinQuantity");
    expect(refusalTechnical(refused)).toBe("BelowMinQuantity (6022): the book fills fewer contracts than the owner's guard");
    expect(refusalWords(refusalName(refused))).toContain("The book moved under your quote");
  });

  it("reads the reason out of a cause chain, and falls back to the first line when no program spoke", () => {
    expect(refusalName(new Error("send failed", { cause: refused }))).toBe("BelowMinQuantity");
    expect(refusalTechnical(new Error("fetch failed\nPOST https://rpc.example/?api-key=secret"))).toBe("fetch failed");
    expect(refusalName(new Error("fetch failed"))).toBeNull();
  });

  it("knows a send whose landing is unknown from one the chain refused", () => {
    const timeout = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    expect(isUnknownLanding(new Error("private mint failed", { cause: timeout }))).toBe(true);
    expect(isUnknownLanding(refused)).toBe(false);
  });
});
