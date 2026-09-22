import { formatUsdc, pct as corePct } from "@agari/core/desk";
import { formatBaseUnits } from "@agari/core/units";

/** The desk's numbers as words: dollars with grouping, tokens to four places, percentages to one, plain relative times. */
const USDC_DP = 6;
const TOKEN_DP = 9;
const TOKEN_SHOWN_DP = 4;

/** "$1,000.00" · "$50.00"; a negative keeps its sign in front of the dollar. */
export function usd(e6: bigint, maxDp = 2): string {
  const negative = e6 < 0n;
  const text = formatBaseUnits(negative ? -e6 : e6, USDC_DP, { maxDp, minDp: maxDp === 0 ? 0 : 2 });
  return `${negative ? "−" : ""}$${text}`;
}
/** "+$12.40" · "−$3.10" · "$0.00". */
export const usdSigned = (e6: bigint): string => (e6 > 0n ? `+${usd(e6)}` : usd(e6));
/** A decimal string from a record ("120.5") as dollars, unchanged when it does not parse. */
export function usdText(decimal: string | null | undefined): string {
  if (decimal === null || decimal === undefined) return "—";
  const [whole = "0", fraction = ""] = decimal.replace(/^-/, "").split(".");
  const cents = fraction.padEnd(2, "0").slice(0, 2);
  return `${decimal.startsWith("-") ? "−" : ""}$${Number(whole).toLocaleString("en-US")}.${cents}`;
}
export const usdcDecimal = (e6: bigint): string => formatUsdc(e6);
/** "4.158 OPENAI" style figures: raw 9 dp shown to four places, trailing zeros dropped. */
export const tokens = (raw: bigint): string => formatBaseUnits(raw, TOKEN_DP, { maxDp: TOKEN_SHOWN_DP, minDp: 0 });
/** A record's decimal token string trimmed to four places. */
export function tokensText(decimal: string | null | undefined): string {
  if (decimal === null || decimal === undefined) return "—";
  const [whole = "0", fraction = ""] = decimal.split(".");
  const cut = fraction.slice(0, TOKEN_SHOWN_DP).replace(/0+$/, "");
  return cut ? `${whole}.${cut}` : whole;
}
/** "12.3%" from basis points (core's rule: one decimal). */
export const pct = (bps: number): string => corePct(Math.abs(bps));
/** "+1.4%" · "−0.6%" · "0.0%". */
export const pctSigned = (bps: number): string => `${bps > 0 ? "+" : bps < 0 ? "−" : ""}${corePct(Math.abs(bps))}`;

/** "23 min" · "2 h 05 min" · "3 d": a span in the reader's units. */
export function span(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s} s`;
  const minutes = Math.round(s / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h${minutes % 60 ? ` ${String(minutes % 60).padStart(2, "0")} min` : ""}`;
  return `${Math.round(hours / 24)} d`;
}
export const ago = (atSec: number, nowSec: number): string => (nowSec - atSec < 45 ? "just now" : `${span(nowSec - atSec)} ago`);
export const until = (atSec: number, nowSec: number): string => (atSec <= nowSec ? "now" : `in ${span(atSec - nowSec)}`);

/** "15:00" in the reader's zone (server and hydration: UTC), for "At the top of the hour, 15:00". */
export function clock(atSec: number, zone: string | null): string {
  const at = new Date(atSec * 1000);
  if (!zone) return `${String(at.getUTCHours()).padStart(2, "0")}:${String(at.getUTCMinutes()).padStart(2, "0")} UTC`;
  return new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).format(at);
}
/** "Sat 22 Sep, 15:00" for a card's expiry and a record's time. */
export function stamp(atSec: number, zone: string | null): string {
  const at = new Date(atSec * 1000);
  return new Intl.DateTimeFormat("en-GB", { ...(zone ? { timeZone: zone } : { timeZone: "UTC" }), weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
}
export const shortHash = (hash: string, lead = 10, tail = 8): string => (hash.length <= lead + tail + 1 ? hash : `${hash.slice(0, lead)}…${hash.slice(-tail)}`);
/** The top of the next hour after `nowSec` (the desk wakes on the hour, plan §5.8). */
export const nextTopOfHour = (nowSec: number): number => (Math.floor(nowSec / 3_600) + 1) * 3_600;
