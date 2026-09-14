import { X_RECEIPT_STATUSES, type XReceipt, type XReceiptStatus } from "@agari/core/x";
import { isSignature } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";

const LABELS: Record<XReceiptStatus, string> = {
  filled: "Order filled",
  submitted: "Instruction received",
  unknown: "Status needs checking",
  refused: "Order not confirmed",
  reverted: "Order reverted",
  "nothing-filled": "No fill",
};

function amount(value: string | null | undefined, decimals: number): string | null {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,77})$/.test(value)
    || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) return null;
  return formatBaseUnits(BigInt(value), decimals, { maxDp: decimals, minDp: 0 });
}

/** A requested stake is never evidence of what a filled order actually spent. */
export function receiptDisplay(receipt: XReceipt, decimals: number, symbol: string) {
  const txHash = isSignature(receipt.txHash) ? receipt.txHash : null;
  let status = X_RECEIPT_STATUSES.includes(receipt.status) ? receipt.status : "unknown";
  // Match the public reply: historical chain-result rows need a usable receipt link.
  if (!txHash && (status === "filled" || status === "nothing-filled" || status === "reverted")) status = "unknown";
  const spent = status === "filled" ? amount(receipt.bookedCostBase, decimals) : null;
  const requested = amount(receipt.stakeBase, decimals);
  const unit = /^[A-Za-z][A-Za-z0-9]{0,11}$/.test(symbol) ? symbol : "collateral";
  const amountText = spent !== null ? `Spent ${spent} ${unit}` : requested !== null ? `Requested ${requested} ${unit}` : null;
  const side = receipt.side === "up" ? "UP" : receipt.side === "down" ? "DOWN" : null;
  return { status, label: LABELS[status], summary: [side, amountText].filter(Boolean).join(" · "), txHash };
}
