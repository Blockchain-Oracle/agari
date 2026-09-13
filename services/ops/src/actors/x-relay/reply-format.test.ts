import { describe, expect, it } from "vitest";
import { SHANNON_EXPLORER_URL } from "@masayume/core/constants";
import { X_RECEIPT_STATUSES, type XReceipt, type XRefusalCode } from "@masayume/core/x";
import { createReplyPresentation, REFUSAL_DETAILS, REPLY_LIMIT, replyText, TRADE_FROM_X_URL } from "./reply-format";

const HASH = `0x${"ab".repeat(32)}`;
const TX_URL = `${SHANNON_EXPLORER_URL}/tx/${HASH}`;
const MAX_UINT256 = (2n ** 256n - 1n).toString();
function receipt(over: Partial<XReceipt> = {}): XReceipt {
  return {
    mentionId: "1", authorId: "2", handle: "example", wallet: null, grantId: null,
    marketId: null, side: "up", stakeBase: "100000000", status: "filled", reason: null,
    txHash: HASH, instruction: "BTC up $100 5m", atMs: 0, asset: "BTC", intervalSec: 300,
    expirySec: Date.parse("2026-09-05T12:00:00Z") / 1000, ...over,
  };
}

// Generated copy is ASCII, and each complete https URL counts as 23 on X.
function weightedLength(text: string): number {
  return text.replace(/https:\/\/[^\s]+/g, "x".repeat(23)).length;
}

describe("public X receipt text", () => {
  it("uses booked spend without calling unused budget a partial fill or a win", () => {
    const result = replyText(receipt({ bookedCostBase: "1234567", bookedContractsRaw: "2000000" }), 6);
    expect(result).toContain("Spent 1.234567 tUSDC.");
    expect(result).not.toContain("100");
    expect(result.toLowerCase()).not.toMatch(/partial|profit|you won/);
    expect(result).toContain("The market result comes later.");
    expect(result).toContain("BTC / UP / 5m Window / ends 2026-09-05 12:00 UTC");
  });

  it("keeps older filled records useful without inventing their booked amount", () => {
    const result = replyText(receipt(), 6);
    expect(result).toContain("Order filled");
    expect(result).toContain("A position was booked. See the transaction for amounts.");
    expect(result).not.toContain("Spent");
    expect(result).toContain(TX_URL);
  });

  it.each([["1", 6, "0.000001"], ["1", 18, "0.000000000000000001"], ["0", 6, "0"], ["1230000", 6, "1.23"]])(
    "preserves every fractional unit: %s at %s decimals",
    (bookedCostBase, decimals, expected) => {
      expect(createReplyPresentation(receipt({ bookedCostBase: String(bookedCostBase) }), Number(decimals)).detail).toBe(`Spent ${expected} tUSDC.`);
    },
  );

  it.each(["-1", "1e6", " 1", "01", "1.5", "9".repeat(79), "@someone", "💰"])("omits malformed booked amount %s", (bookedCostBase) => {
    expect(createReplyPresentation(receipt({ bookedCostBase }), 6).detail).not.toContain("Spent");
  });

  it.each([-1, 19, 6.5, Number.NaN, Infinity])("does not guess an invalid collateral precision %s", (decimals) => {
    expect(createReplyPresentation(receipt({ bookedCostBase: "1" }), decimals).detail).not.toContain("Spent");
  });

  it("keeps no-fill, unknown, reverted and initial instruction states distinct", () => {
    expect(replyText(receipt({ status: "nothing-filled" }), 6)).toContain("No position was booked.");
    expect(replyText(receipt({ status: "reverted" }), 6)).toContain("Transaction gas may still have been spent.");
    expect(replyText(receipt({ status: "submitted", txHash: null }), 6)).toContain("Checks are in progress; no confirmed trade yet.");
    const pending = replyText(receipt({ status: "unknown" }), 6);
    expect(pending).toContain("Status needs checking");
    expect(pending).toContain("Check the linked transaction for the latest result.");
    expect(pending).toContain(TX_URL);
    expect(pending).not.toMatch(/will reconcile|Order filled|won|Waiting for a confirmed chain receipt|Confirmation pending/);
  });

  it.each([null, "0x123", `${HASH}\nhttps://example.com`, "https://example.com", `0x${"z".repeat(64)}`])("uses an honest recovery link when hash is invalid: %s", (txHash) => {
    for (const status of ["unknown", "filled", "nothing-filled", "reverted"] as const) {
      const model = createReplyPresentation(receipt({ status, txHash }), 6);
      expect(model.status).toBe("unknown");
      expect(model.title).toBe("Status needs checking");
      expect(model.detail).toBe("We could not confirm whether the order was sent.");
      expect(model.url).toBe(TRADE_FROM_X_URL);
    }
  });

  it("publishes safe refusal categories without raw diagnostics or instructions", () => {
    for (const refusalCode of Object.keys(REFUSAL_DETAILS) as XRefusalCode[]) {
      const result = replyText(receipt({ status: "refused", refusalCode, txHash: null, reason: "private RPC token secret", instruction: "@victim malicious 💰" }), 6);
      expect(result).toContain(REFUSAL_DETAILS[refusalCode]);
      expect(result).not.toMatch(/token|secret|@victim|not sent|never sent/);
    }
  });

  it("links permission refusals directly to the update controls while preserving known transactions", () => {
    const refused = receipt({ status: "refused", refusalCode: "grant-update-required", txHash: null });
    expect(createReplyPresentation(refused, 6).url).toBe(`${TRADE_FROM_X_URL}#x-trading`);
    expect(createReplyPresentation({ ...refused, refusalCode: "position-limit" }, 6).url).toBe("https://masayume.app/portfolio");
    expect(createReplyPresentation({ ...refused, txHash: HASH }, 6).url).toBe(TX_URL);
  });
  it("preserves a closed Window's precise recovery reason and instruction-builder link", () => {
    const model = createReplyPresentation(receipt({ status: "refused", refusalCode: "window-entry-closed", txHash: null, entryClosesAtSec: Date.parse("2026-09-10T08:24:30Z") / 1000 }), 6);
    expect(model.title).toBe("Entries closed");
    expect(model.detail).toContain("08:24:30 UTC");
    expect(model.url).toBe(`${TRADE_FROM_X_URL}#x-instruction`);
  });

  it.each(["constructor", "__proto__", "toString", "unknown-code"])("does not index inherited refusal copy: %s", (code) => {
    const model = createReplyPresentation(receipt({ status: "refused", refusalCode: code as XRefusalCode }), 6);
    expect(model.detail).toBe(REFUSAL_DETAILS.unconfirmed);
  });

  it("validates all public context and defaults invalid statuses to uncertainty", () => {
    const model = createReplyPresentation(receipt({ status: "win" as XReceipt["status"], asset: "@victim💰", side: "win" as XReceipt["side"], intervalSec: 7, expirySec: Number.MAX_SAFE_INTEGER }), 6);
    expect(model.status).toBe("unknown");
    expect(model.context).toBe("Somnia testnet");
    const filled = createReplyPresentation(receipt({ bookedCostBase: "1" }), 6, "USD\n@victim");
    expect(filled.detail).toBe("Spent 0.000001 collateral.");
  });

  it("omits invalid dates without throwing and formats UTC independently of host timezone", () => {
    for (const expirySec of [-1, 0.5, Infinity, Number.NaN, 253402300800]) {
      expect(createReplyPresentation(receipt({ expirySec }), 6).context).not.toContain("ends");
    }
    expect(createReplyPresentation(receipt({ expirySec: 0 }), 6).context).toContain("ends 1970-01-01 00:00 UTC");
    expect(createReplyPresentation(receipt({ expirySec: 31 }), 6).context).toContain("ends 1970-01-01 00:00:31 UTC");
  });

  it("stays within raw and weighted standard-post limits with real newlines and intact links", () => {
    for (const status of X_RECEIPT_STATUSES) for (const decimals of [0, 6, 18]) for (const txHash of [HASH, null]) {
      const result = replyText(receipt({ status, txHash, side: "down", asset: "ETH", intervalSec: 14400, bookedCostBase: MAX_UINT256, expirySec: 253402300799 }), decimals, "LongestToken");
      expect(result.length).toBeLessThanOrEqual(REPLY_LIMIT);
      expect(weightedLength(result)).toBeLessThanOrEqual(REPLY_LIMIT);
      expect(result).toMatch(/^[\x00-\x7F]+$/);
      expect(result).toContain("\n");
      expect(result).not.toContain("\\n");
      expect(result.split("\n").at(-1)).toBe(txHash ? TX_URL : TRADE_FROM_X_URL);
    }
  });
});
