import { describe, expect, it } from "vitest";
import { chainFailure, failureDiagnosis } from "./chain-failure";
import { failingProduct } from "./product-failure";

const PARLAY = "H4gdpoPirbtHP6hNdiQRLwfifjshdgDamYuvrGxj2ZCC";
const RANGE = "GfsAzxPeNp2cbUTrXehHBjLjAMX6Cf69gz2zJYkGM7ha";
const EVENTS = "cDcHZiQ1WYAHbSjxMoju86fbC8azrtQg7dzrWKynANH";
const VAULT = "84puRVxGcjs7JNcPCVAEkkK6ZFXneEC8yky8RTMzhPi9";
const custom = (code: number) => ({ InstructionError: [0, { Custom: code }] });

describe("a product program's refusal", () => {
  it("is named from its own table, not the engine's (the devnet NotStale of 2026-09-20)", () => {
    const logs = [
      `Program ${PARLAY} invoke [1]`,
      "Program log: Instruction: PublicVoidStale",
      "Program log: AnchorError thrown in programs/agari-parlay/src/instructions/resolve.rs:72. Error Code: NotStale. Error Number: 6026.",
      `Program ${PARLAY} failed: custom program error: 0x178a`,
    ];
    const failure = chainFailure(custom(6026), logs);
    expect(failure.engineCode).toBeNull();
    const diagnosis = failureDiagnosis(failure);
    expect(diagnosis.kind).toBe("contract-revert");
    expect(diagnosis.technical).toContain("agari-parlay 6026: the ticket is not stale enough to void");
  });

  it("tells a thin book and a moved price apart from a revert", () => {
    const failed = (program: string) => [`Program ${program} invoke [1]`, `Program ${program} failed: custom program error`];
    expect(failureDiagnosis(chainFailure(custom(6010), failed(PARLAY))).kind).toBe("thin-book");
    expect(failureDiagnosis(chainFailure(custom(6015), failed(PARLAY))).kind).toBe("requote");
    expect(failureDiagnosis(chainFailure(custom(6016), failed(PARLAY))).kind).toBe("reserve-cap");
    expect(failureDiagnosis(chainFailure(custom(6005), failed(RANGE))).kind).toBe("thin-book");
    expect(failureDiagnosis(chainFailure(custom(6013), failed(RANGE))).kind).toBe("requote");
  });

  it("leaves an engine refusal an engine refusal, also when it came up through a product's CPI", () => {
    // The engine refuses inside the vault's CPI: both frames log `failed`, the engine's first.
    const logs = [`Program ${VAULT} invoke [1]`, `Program ${EVENTS} invoke [2]`, `Program ${EVENTS} failed: custom program error: 0x17de`, `Program ${VAULT} failed: custom program error: 0x17de`];
    expect(failingProduct(logs)).toBeNull();
    expect(chainFailure(custom(6110), logs).engineCode).toBe(6110);
    expect(chainFailure(custom(6110), []).engineCode).toBe(6110);
  });
});
