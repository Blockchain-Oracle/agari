import { describe, expect, it } from "vitest";
import { diagnosis, toMarketId, type DiagnosisKind, type Quote } from "@masayume/core/types";
import { outcomeToReceipt } from "./receipt-outcome";

const HASH = `0x${"ab".repeat(32)}` as const;
const PRIVATE_DIAGNOSTIC = "Provider error at https://private-rpc.example/?key=secret";

describe("X execution receipt truth", () => {
  it.each([
    ["OverStakeCap", "grant-update-required"], ["OverDailyCap", "grant-update-required"],
    ["OverPositionCap", "position-limit"], ["Insufficient", "insufficient-funds"], ["GrantExpired", "grant-expired"],
  ])("retains actionable refusal category %s without provider text", (errorName, refusalCode) => {
    const result = outcomeToReceipt({ status: "refused", diagnosis: diagnosis("grant-refused", PRIVATE_DIAGNOSTIC, { errorName }) });
    expect(result.refusalCode).toBe(refusalCode);
    expect(result.reason).not.toContain("secret");
  });
  it("preserves actual fill measurements without replacing the requested stake", () => {
    const original = { stakeBase: "100000000" };
    const result = { ...original, ...outcomeToReceipt({ status: "confirmed", booked: {
      marketId: toMarketId(`0x${"11".repeat(32)}`), side: "up", contractsRaw: 2469134n,
      costBase: 1234567n, avgPriceBps: 5000, txHash: HASH, fillCount: 1,
    } }) };
    expect(result).toMatchObject({ status: "filled", txHash: HASH, stakeBase: "100000000", bookedCostBase: "1234567", bookedContractsRaw: "2469134", avgPriceBps: 5000, reason: null });
  });

  it("does not equate a mined empty transaction with a filled order", () => {
    expect(outcomeToReceipt({ status: "nothingFilled", txHash: HASH })).toEqual({ status: "nothing-filled", reason: "No position was booked.", txHash: HASH });
  });

  it.each(["grant-refused", "daily-stop", "insufficient-collateral", "out-of-gas", "not-deployed", "rpc-down", "unknown", "constructor", "__proto__"])("redacts provider diagnostics for refusal %s", (kind) => {
    const result = outcomeToReceipt({ status: "refused", diagnosis: diagnosis(kind as DiagnosisKind, PRIVATE_DIAGNOSTIC) });
    expect(result.status).toBe("refused");
    expect(result.reason).not.toMatch(/private-rpc|secret|Provider|not sent|never sent/);
    expect(typeof result.reason).toBe("string");
    expect(typeof result.refusalCode).toBe("string");
  });

  it("retains a diagnostic hash instead of inferring a refusal happened before broadcast", () => {
    expect(outcomeToReceipt({ status: "refused", diagnosis: diagnosis("unknown", PRIVATE_DIAGNOSTIC, { txHash: HASH }) }).txHash).toBe(HASH);
  });

  it("keeps uncertainty with and without a hash, without promising a future reconciliation", () => {
    for (const hash of [HASH, undefined]) {
      const result = outcomeToReceipt({ status: "unknown", diagnosis: diagnosis("send-unknown", PRIVATE_DIAGNOSTIC), txHash: hash });
      expect(result).toMatchObject({ status: "unknown", txHash: hash ?? null });
      expect(result.reason).not.toMatch(/private-rpc|secret|will|not sent/);
    }
    expect(outcomeToReceipt({ status: "unknown", diagnosis: diagnosis("send-unknown", PRIVATE_DIAGNOSTIC, { txHash: HASH }) }).txHash).toBe(HASH);
  });

  it("retains reverted transaction evidence without leaking its error", () => {
    expect(outcomeToReceipt({ status: "reverted", diagnosis: diagnosis("contract-revert", PRIVATE_DIAGNOSTIC), txHash: HASH })).toEqual({ status: "reverted", reason: "The trade reverted on-chain.", txHash: HASH });
  });

  it("turns a fresh higher-cost quote into a fixed refusal", () => {
    const quote: Quote = { side: "up", stakeBase: 1n, contractsRaw: 2n, expectedCostBase: 1n, maxCostBase: 2n, limitPriceRaw: 1n, avgPriceBps: 5000, oddsCents: 50, payoutIfRightBase: 2n, fillableStakeBase: 1n, partial: false, feeBps: 0, decimals: 6, quotedAtMs: 0 };
    expect(outcomeToReceipt({ status: "requote", quote })).toEqual({ status: "refused", refusalCode: "price-moved", reason: "The price moved beyond the accepted cost.", txHash: null });
  });
});
