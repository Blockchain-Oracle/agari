import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { X_REFUSAL_TITLES, type XReceiptStatus } from "@masayume/core/x";

/** Structural subset of ReplyPresentation. All facts come from the receipt formatter. */
export interface ReplyCardInput {
  status: XReceiptStatus;
  title?: string;
  detail?: string;
  context?: string;
  footer?: string;
  sender?: string | null;
  txHash?: string | null;
}

export interface ReplyCardOptions {
  /** Only for review fixtures. Never disguise a fixture as a real receipt. */
  demo?: boolean;
}

export const REPLY_CARD_WIDTH = 1200;
export const REPLY_CARD_HEIGHT = 600;

interface OutlineFont {
  getAdvanceWidth(text: string, size: number, options?: { kerning: boolean }): number;
  getPath(text: string, x: number, y: number, size: number, options?: { kerning: boolean }): { toPathData(places: number): string };
}
const require = createRequire(import.meta.url);
const opentype = require("opentype.js") as { loadSync(file: string): OutlineFont };
// Keep licensed fonts with the actor so the production Docker copy includes them.
const sora = opentype.loadSync(fileURLToPath(new URL("./reply-card-assets/Sora-SemiBold.ttf", import.meta.url)));
const inter = opentype.loadSync(fileURLToPath(new URL("./reply-card-assets/Inter-Regular.ttf", import.meta.url)));
const INK = "#FAFAFA";
const MUTED = "#B9B1A6";
const ORANGE = "#E04D26";

const states: Record<XReceiptStatus, { title: string; footer: string }> = {
  filled: { title: "Order filled", footer: "The market result comes later." },
  submitted: { title: "Instruction received", footer: "Execution has not been confirmed." },
  unknown: { title: "Status needs checking", footer: "Check the app before trying again." },
  refused: { title: "Order not confirmed", footer: "This instruction was not confirmed." },
  reverted: { title: "Order reverted", footer: "Transaction gas may still have been spent." },
  "nothing-filled": { title: "No fill", footer: "A successful transaction does not guarantee a fill." },
};

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function plain(value: unknown, limit: number): string {
  if (typeof value !== "string") return "";
  // Bound work before processing, strip XML-invalid/control and bidi characters,
  // and collapse line breaks so data cannot move itself around the composition.
  const cleaned = value.slice(0, 2048)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\uFFFE\uFFFF]/g, "")
    .replace(/\s+/g, " ").trim();
  const chars = Array.from(cleaned);
  return chars.length > limit ? `${chars.slice(0, limit - 1).join("")}…` : cleaned;
}

function width(font: OutlineFont, value: string, size: number): number {
  return font.getAdvanceWidth(value, size, { kerning: true });
}

/** Wrap even a single long token and ellipsize without crossing the text column. */
function lines(value: string, font: OutlineFont, size: number, maxWidth: number, maxLines: number): string[] {
  const remaining = Array.from(value);
  const result: string[] = [];
  while (remaining.length > 0 && result.length < maxLines) {
    let end = 0;
    while (end < remaining.length && width(font, remaining.slice(0, end + 1).join(""), size) <= maxWidth) end++;
    if (end === remaining.length) { result.push(remaining.join("").trim()); break; }
    if (result.length === maxLines - 1) {
      let tail = remaining.slice(0, Math.max(1, end));
      while (tail.length && width(font, `${tail.join("").trimEnd()}…`, size) > maxWidth) tail.pop();
      result.push(`${tail.join("").trimEnd()}…`);
      break;
    }
    const space = remaining.slice(0, end).lastIndexOf(" ");
    const split = space > end / 2 ? space : Math.max(1, end);
    result.push(remaining.splice(0, split).join("").trim());
    while (remaining[0] === " ") remaining.shift();
  }
  return result;
}

function text(value: string, x: number, baseline: number, size: number, fill: string, font = inter): string {
  return `<g role="img" aria-label="${escapeXml(value)}"><path d="${font.getPath(value, x, baseline, size, { kerning: true }).toPathData(2)}" fill="${fill}"/></g>`;
}

/** Exact Masayume mark geometry, shared with the app and docs brand. */
function mark(x: number, y: number, height: number, ink: string): string {
  return `<g transform="translate(${x} ${y}) scale(${height / 322})" aria-hidden="true"><path d="M56 120 A 88 88 0 1 0 210 120" stroke="${ink}" fill="none" stroke-width="34" stroke-linecap="round"/><circle cx="133" cy="62" r="30" fill="${ORANGE}"/></g>`;
}

function receiptArt(status: XReceiptStatus): string {
  const symbol: Record<XReceiptStatus, string> = {
    filled: '<path d="M889 320L915 349L966 287"/>',
    submitted: '<path d="M931 282V320L953 337"/>',
    unknown: '<path d="M914 297C914 276 950 276 950 297C950 311 932 311 932 327M932 347V349"/>',
    refused: '<path d="M910 294L952 342M952 294L910 342"/>',
    reverted: '<path d="M946 287H913L897 305L913 322M898 305H940C969 305 969 347 940 347H921"/>',
    "nothing-filled": '<path d="M905 320H958"/>',
  };
  return `<g aria-hidden="true" transform="rotate(7 970 307)">
<path d="M1093 407C1151 414 1151 465 1114 477H1006V439Z" fill="#B9AC98"/>
<path d="M817 145L828 152L839 145L850 152L861 145L872 152L883 145L894 152L905 145L916 152L927 145L938 152L949 145L960 152L971 145L982 152L993 145L1004 152L1015 145L1026 152L1037 145L1048 152L1059 145L1070 152L1081 145V430Q1081 469 1114 477L839 477Q817 477 817 449Z" fill="#F4EEE3" stroke="#D6CBBE" stroke-width="1.5"/>
${mark(909, 174, 49, "#211C18")}
<path d="M842 245H1054M842 396H1054M842 418H978" stroke="#C7BBA8" stroke-width="1.5"/>
<circle cx="931" cy="320" r="62" stroke="${ORANGE}" stroke-width="4" fill="none"/>
<g data-symbol="${status}" fill="none" stroke="${ORANGE}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">${symbol[status]}</g>
</g>`;
}

/** Render facts as self-contained vector paths, with no font/network dependencies. */
export function renderReplyCardSvg(input: ReplyCardInput, options: ReplyCardOptions = {}): string {
  const status: XReceiptStatus = Object.hasOwn(states, input.status) ? input.status : "unknown";
  const state = states[status];
  // Only fixed refusal titles may refine the status headline. Unknown outcomes
  // must never imply success or that chain confirmation is still pending.
  const title = status === "refused" && Object.values(X_REFUSAL_TITLES).some(title => title === input.title) ? input.title! : state.title;
  const footer = status === "unknown" && input.footer === "Check this transaction before trying again."
    ? input.footer : state.footer;
  const context = plain(input.context, 180) || "Somnia Shannon testnet";
  const detail = plain(input.detail, 420) || "Open the receipt for details.";
  const sender = typeof input.sender === "string" && /^(@[A-Za-z0-9_]{1,15}|X user \d{1,30})$/.test(input.sender) ? input.sender : null;
  const hash = typeof input.txHash === "string" && /^0x[0-9a-fA-F]{64}$/.test(input.txHash) ? input.txHash : null;
  const contextLines = lines(context, inter, 27, 690, 2);
  const detailLines = lines(detail, inter, 22, 690, 2);
  const titleSize = Math.min(72, 690 / width(sora, title, 1));
  const banner = options.demo ? "DEMO · NOT A REAL TRADE" : "SOMNIA SHANNON TESTNET";
  const description = `${banner}. ${sender ? `For ${sender}. ` : ""}${title}. ${contextLines.join(" ")}. ${detailLines.join(" ")}. ${footer}${hash ? ` Transaction ${hash}.` : ""}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600" width="1200" height="600" role="img" aria-labelledby="reply-title reply-description" data-status="${status}">
<title id="reply-title">${escapeXml(title)} — Masayume</title>
<desc id="reply-description">${escapeXml(description)}</desc>
<rect width="1200" height="600" fill="#050505"/>
${mark(963, 32, 42, INK)}
${text("Masayume", 1008, 61, 20, INK, sora)}
${sender ? text(`FOR ${sender}`, 64, 104, 19, INK) : ""}
${text("YOUR CALL HAS A RECEIPT", 64, 146, 16, ORANGE)}
${text(title, 60, 235, titleSize, INK, sora)}
${contextLines.map((line, i) => text(line, 64, 298 + i * 33, 27, INK)).join("\n")}
${detailLines.map((line, i) => text(line, 64, 372 + i * 29, 22, MUTED)).join("\n")}
${text(footer, 64, 444, 20, MUTED)}
${hash ? text(`TX ${hash}`, 64, 491, Math.min(15, 690 / width(inter, `TX ${hash}`, 1)), MUTED) : ""}
${receiptArt(status)}
<path d="M64 523H1136" stroke="#39332D"/>
${text("masayume.app · Receipt details in the reply", 64, 563, 15, MUTED)}
${text(banner, 1136 - width(inter, banner, 15), 563, 15, ORANGE)}
</svg>`;
}

/** Return a deterministic PNG ready for a separately authorized media uploader. */
export async function renderReplyCardPng(input: ReplyCardInput, options: ReplyCardOptions = {}): Promise<Buffer> {
  return sharp(Buffer.from(renderReplyCardSvg(input, options))).png({ compressionLevel: 9 }).toBuffer();
}
