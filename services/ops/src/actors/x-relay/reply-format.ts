import { SHANNON_EXPLORER_URL } from "@masayume/core/constants";
import { formatBaseUnits } from "@masayume/core/units";
import { X_RECEIPT_STATUSES, xRefusalCopy, xReceiptRecovery, type XReceipt, type XReceiptStatus } from "@masayume/core/x";

export const REPLY_LIMIT = 280;
export const TRADE_FROM_X_URL = "https://masayume.app/trade-from-x";

export { X_REFUSAL_DETAILS as REFUSAL_DETAILS } from "@masayume/core/x";

export interface ReplyPresentation {
  status: XReceiptStatus;
  title: string;
  detail: string;
  context?: string;
  footer?: string;
  url: string;
  sender: string | null;
  txHash: string | null;
}

const BASE_UNITS = /^(0|[1-9]\d{0,77})$/;
const TX_HASH = /^0x[0-9a-fA-F]{64}$/;
const CADENCES: Record<number, string> = { 60: "1m", 300: "5m", 900: "15m", 3600: "1h", 14400: "4h", 86400: "1d" };

function amount(value: string | null | undefined, decimals: number): string | null {
  if (typeof value !== "string" || !BASE_UNITS.test(value) || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) return null;
  // Every supported fractional unit survives: a 0.000001 tUSDC fill must never say 0.00.
  return formatBaseUnits(BigInt(value), decimals, { maxDp: decimals, minDp: 0, group: false });
}

function marketContext(receipt: XReceipt): string {
  const asset = receipt.asset === "BTC" || receipt.asset === "ETH" ? receipt.asset : null;
  const side = receipt.side === "up" ? "UP" : receipt.side === "down" ? "DOWN" : null;
  const cadence = Number.isInteger(receipt.intervalSec) ? CADENCES[receipt.intervalSec as number] : undefined;
  const expiry = receipt.expirySec;
  const ends = typeof expiry === "number" && Number.isSafeInteger(expiry) && expiry >= 0 && expiry <= 253402300799
    ? `${new Date(expiry * 1000).toISOString().slice(0, expiry % 60 === 0 ? 16 : 19).replace("T", " ")} UTC`
    : null;
  return ["Somnia testnet", asset, side, cadence ? `${cadence} Window` : null, ends ? `ends ${ends}` : null].filter(Boolean).join(" / ");
}

/** Only validated receipt facts and fixed copy reach public text or the deterministic card renderer. */
export function createReplyPresentation(receipt: XReceipt, decimals: number, symbol = "tUSDC"): ReplyPresentation {
  const hash = typeof receipt.txHash === "string" && TX_HASH.test(receipt.txHash) ? receipt.txHash : null;
  let status = X_RECEIPT_STATUSES.includes(receipt.status) ? receipt.status : "unknown";
  // A corrupt historical row must not produce a chain-result claim without a usable receipt link.
  if (!hash && (status === "filled" || status === "nothing-filled" || status === "reverted")) status = "unknown";
  const context = marketContext(receipt);
  const url = hash ? `${SHANNON_EXPLORER_URL}/tx/${hash}` : TRADE_FROM_X_URL;
  // The receipt's original author snapshot is immutable; never resolve a current profile here.
  const sender = typeof receipt.handle === "string" && /^[A-Za-z0-9_]{1,15}$/.test(receipt.handle)
    ? `@${receipt.handle}` : /^\d{1,30}$/.test(receipt.authorId) ? `X user ${receipt.authorId}` : null;
  const base = { status, context, url, sender, txHash: hash };
  switch (status) {
    case "filled": {
      const spent = amount(receipt.bookedCostBase, decimals);
      const unit = /^[A-Za-z][A-Za-z0-9]{0,11}$/.test(symbol) ? symbol : "collateral";
      return { ...base, title: "Order filled", detail: spent === null ? "A position was booked. See the transaction for amounts." : `Spent ${spent} ${unit}.`, footer: "The market result comes later." };
    }
    case "nothing-filled":
      return { ...base, title: "No fill", detail: "No position was booked.", footer: "A successful transaction does not guarantee a fill." };
    case "reverted":
      return { ...base, title: "Order reverted", detail: "The trade reverted on-chain.", footer: "Transaction gas may still have been spent." };
    case "unknown":
      return hash
        ? { ...base, title: "Status needs checking", detail: "Check the linked transaction for the latest result.", footer: "Check this transaction before trying again." }
        : { ...base, title: "Status needs checking", detail: "We could not confirm whether the order was sent.", footer: "Check the app before trying again." };
    case "submitted":
      return { ...base, title: "Instruction received", detail: "Checks are in progress; no confirmed trade yet." };
    case "refused": {
      const code = receipt.refusalCode ?? "unconfirmed";
      const recovery = xReceiptRecovery(code);
      return { ...base, ...xRefusalCopy(receipt), url: !hash && recovery ? `https://masayume.app${recovery.href}` : url };
    }
  }
}

/** Public replies are ASCII. With these URLs, the raw length also bounds X's weighted length. */
export function replyText(receipt: XReceipt, decimals: number, symbol = "tUSDC"): string {
  const presentation = createReplyPresentation(receipt, decimals, symbol);
  const sender = presentation.sender ? `For ${presentation.sender}` : null;
  const lines = [presentation.title, presentation.context, sender, presentation.detail, presentation.footer, presentation.url];
  let text = lines.filter(Boolean).join("\n");
  if (text.length > REPLY_LIMIT) {
    lines[1] = "Somnia testnet";
    text = lines.filter(Boolean).join("\n");
  }
  // Keep the exact amount and complete URL. Optional context is the first thing removed.
  if (text.length > REPLY_LIMIT) text = [presentation.title, sender, presentation.detail, presentation.footer, presentation.url].filter(Boolean).join("\n");
  if (text.length > REPLY_LIMIT) text = [presentation.title, sender, "Check the linked receipt for details.", presentation.footer, presentation.url].filter(Boolean).join("\n");
  return text;
}
