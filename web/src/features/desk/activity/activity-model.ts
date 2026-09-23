import { nameOf } from "@agari/core/desk";
import { PRE_IPO_SYMBOLS, type PreIpoSymbol } from "@agari/core/market";
import { ACTIVITY } from "./copy-activity";

/**
 * Pure helpers for the activity timeline (S22). A record's summary is written from core's `nameOf`, so the companies
 * it names are found by those same names, in the order they appear.
 */
export function namesIn(summary: string): PreIpoSymbol[] {
  return PRE_IPO_SYMBOLS.map((s) => [s, summary.indexOf(nameOf(s))] as const)
    .filter(([, at]) => at >= 0)
    .sort((a, b) => a[1] - b[1])
    .map(([s]) => s);
}

const ymd = (atSec: number, zone: string | null): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: zone ?? "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(atSec * 1000));

export const dayKey = ymd;

/** "Today" · "Yesterday" · "Mon 21 Sep". */
export function dayLabel(atSec: number, nowSec: number, zone: string | null): string {
  const day = ymd(atSec, zone);
  if (day === ymd(nowSec, zone)) return ACTIVITY.today;
  if (day === ymd(nowSec - 86_400, zone)) return ACTIVITY.yesterday;
  return new Intl.DateTimeFormat("en-GB", { timeZone: zone ?? "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(atSec * 1000));
}
