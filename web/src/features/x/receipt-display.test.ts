import { describe, expect, it } from "vitest";
import type { XReceipt, XReceiptStatus } from "@masayume/core/x";
import { receiptDisplay } from "./receipt-display";

const receipt: XReceipt = {
  mentionId: "fixture", authorId: "fixture", handle: null, wallet: null, grantId: null, marketId: null,
  side: "up", stakeBase: "5000000", bookedCostBase: "4950000", status: "filled", reason: null,
  txHash: `0x${"a".repeat(64)}`, instruction: "test fixture", atMs: 0,
};

describe("X receipt amounts and status", () => {
  it("shows actual booked cost instead of requested stake only for a confirmed fill", () => {
    expect(receiptDisplay(receipt, 6, "tUSDC").summary).toBe("UP · Spent 4.95 tUSDC");
    expect(receiptDisplay({ ...receipt, bookedCostBase: null }, 6, "tUSDC").summary).toBe("UP · Requested 5 tUSDC");
    for (const status of ["submitted", "unknown", "refused", "reverted", "nothing-filled"] as const) {
      expect(receiptDisplay({ ...receipt, status }, 6, "tUSDC").summary).toBe("UP · Requested 5 tUSDC");
    }
  });

  it("preserves the smallest valid booked and requested units, including zero", () => {
    expect(receiptDisplay({ ...receipt, bookedCostBase: "1" }, 6, "tUSDC").summary).toContain("Spent 0.000001 tUSDC");
    expect(receiptDisplay({ ...receipt, status: "submitted", stakeBase: "1" }, 18, "TEST").summary).toContain("Requested 0.000000000000000001 TEST");
    expect(receiptDisplay({ ...receipt, status: "submitted", stakeBase: "0" }, 6, "tUSDC").summary).toContain("Requested 0 tUSDC");
  });

  it("does not crash or manufacture amounts from malformed receipt data", () => {
    for (const value of ["-1", "1.5", "1e6", "0xFF", "NaN", "9".repeat(79), "", null]) {
      expect(receiptDisplay({ ...receipt, bookedCostBase: value, stakeBase: value }, 6, "tUSDC").summary).toBe("UP");
    }
    for (const decimals of [-1, 1.5, 19, Number.NaN]) expect(receiptDisplay(receipt, decimals, "tUSDC").summary).toBe("UP");
  });

  it("uses human-readable states and validates the entire transaction hash", () => {
    expect(receiptDisplay(receipt, 6, "tUSDC")).toMatchObject({ label: "Order filled", txHash: receipt.txHash });
    expect(receiptDisplay({ ...receipt, status: "unknown" }, 6, "tUSDC").label).toBe("Status needs checking");
    for (const txHash of [null, "0x123", `${receipt.txHash}/evil`, `${receipt.txHash}?x=1`, `0x${"z".repeat(64)}`]) {
      expect(receiptDisplay({ ...receipt, txHash }, 6, "tUSDC")).toMatchObject({ status: "unknown", label: "Status needs checking", summary: "UP · Requested 5 tUSDC", txHash: null });
    }
    expect(receiptDisplay({ ...receipt, status: "invalid" as XReceiptStatus }, 6, "tUSDC").label).toBe("Status needs checking");
  });
});
