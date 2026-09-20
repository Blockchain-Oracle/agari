import { describe, expect, it } from "vitest";
import { chainFailure, failureDiagnosis } from "./chain-failure";
import { failingProduct, refusedByEngine } from "./product-failure";

const PARLAY = "H4gdpoPirbtHP6hNdiQRLwfifjshdgDamYuvrGxj2ZCC";
const RANGE = "GfsAzxPeNp2cbUTrXehHBjLjAMX6Cf69gz2zJYkGM7ha";
const EVENTS = "cDcHZiQ1WYAHbSjxMoju86fbC8azrtQg7dzrWKynANH";
const VAULT = "84puRVxGcjs7JNcPCVAEkkK6ZFXneEC8yky8RTMzhPi9";
const STRATEGY = "2yiPYmuNQxpfC3nCk66KzkW72uCbkT6hHwLRSHpYDskQ";
const LEVERAGE = "2yMrhq686tL6uAUFHfKGsPZAWSGoQoRW9HxNvnAZJeQb";
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

  it("reads the boost reserve's refusals from its own table, and the engine's through it as the engine's", () => {
    const failed = (program: string) => [`Program ${program} invoke [1]`, `Program ${program} failed: custom program error`];
    // 6016 UnhealthyAtEntry, 6013 BelowMinQuantity, 6018 OverWindowCap, 6007 WindowPredatesReserve, 6028 StillHealthy.
    expect(failureDiagnosis(chainFailure(custom(6016), failed(LEVERAGE))).kind).toBe("thin-book");
    expect(failureDiagnosis(chainFailure(custom(6013), failed(LEVERAGE))).kind).toBe("requote");
    expect(failureDiagnosis(chainFailure(custom(6018), failed(LEVERAGE))).kind).toBe("reserve-cap");
    expect(failureDiagnosis(chainFailure(custom(6007), failed(LEVERAGE))).kind).toBe("market-not-trading");
    expect(failureDiagnosis(chainFailure(custom(6028), failed(LEVERAGE))).technical).toContain("agari-leverage 6028");
    expect(chainFailure(custom(6016), failed(LEVERAGE)).engineCode).toBeNull();

    // The engine refuses the reserve's IOC inside the CPI: the engine's frame fails first, so the code is the engine's.
    const through = [`Program ${LEVERAGE} invoke [1]`, `Program ${EVENTS} invoke [2]`, `Program ${EVENTS} failed: custom program error: 0x17de`, `Program ${LEVERAGE} failed: custom program error: 0x17de`];
    expect(failingProduct(through)).toBeNull();
    expect(chainFailure(custom(6110), through).engineCode).toBe(6110);
  });

  it("never calls a code the engine's when another program refused, listed here or not", () => {
    // The devnet refusals of 2026-09-20: agari-strategy's CapsOutsideEnvelope and FeeAboveMax.
    const failed = (program: string) => [`Program ${program} invoke [1]`, `Program ${program} failed: custom program error`];
    expect(chainFailure(custom(6013), failed(STRATEGY)).engineCode).toBeNull();
    expect(failureDiagnosis(chainFailure(custom(6013), failed(STRATEGY))).kind).toBe("grant-refused");
    expect(failureDiagnosis(chainFailure(custom(6014), failed(STRATEGY))).kind).toBe("requote");
    expect(failureDiagnosis(chainFailure(custom(6013), failed(STRATEGY))).technical).toContain("agari-strategy 6013");

    // A program nobody has listed: not the engine's code, and not mislabelled as one.
    const unknown = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
    expect(refusedByEngine(failed(unknown))).toBe(false);
    const diagnosis = failureDiagnosis(chainFailure(custom(6013), failed(unknown)));
    expect(diagnosis.kind).toBe("contract-revert");
    expect(diagnosis.technical).not.toContain("agari-events");
  });
});

