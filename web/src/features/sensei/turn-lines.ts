import { ET_WEEKDAY_SHORT, weekdayOfDate, type TickerSymbol } from "@agari/core/market";
import type { EarningsEvent } from "@/lib/finnhub.server";
import type { SenseiPosition, SenseiRecord, SenseiSession } from "./protocol";
import { centsText } from "./units";

/**
 * The per-turn lines Sensei's server adds about the session, the reader's own book and earnings (S13 spec §1.1).
 *
 * Pure strings over the request, so the route stays a transport and the whole block can be measured: it has to stay
 * under 2 KB with eight positions, four Windows and the full earnings list, because it rides on every turn.
 */

/** The report horizon the prompt speaks about; the Finnhub client serves it from its 6 h cache. */
export const EARNINGS_DAYS = 14;
/** Enough for every ticker in the registry; a longer list is noise in a two-sentence read. */
const EARNINGS_MAX = 10;
const DATE_ET = /^\d{4}-\d{2}-\d{2}$/;

export interface EarningsTurn {
  /** Null when the calendar could not be read (no key, upstream down, or not back in time). A type-only import of the client. */
  events: readonly EarningsEvent[] | null;
  symbols: readonly TickerSymbol[];
}

const SIDE = { up: "UP", down: "DOWN", both: "both sides" } as const;
const REPORT_HOUR = { bmo: " before the open", amc: " after the close", dmh: " during market hours" } as const;

/** Regular hours, early close included: the only states in which Windows list. */
export function isSessionOpen(session: SenseiSession): boolean {
  return session.state === "regular" || session.state === "early-close";
}

const lowerFirst = (label: string): string => label.charAt(0).toLowerCase() + label.slice(1);

/** "NYSE session: open, closes 16:00 ET." · "Market closed, opens Tue 09:30 ET." · halted · unreadable. */
export function sessionLine(session: SenseiSession | null): string {
  if (session === null) return "The NYSE session could not be read this turn. Do not guess market hours.";
  if (session.state === "halted") return "NYSE session: trading halted. No new Window opens until it resumes.";
  if (isSessionOpen(session)) return `NYSE session: open, ${lowerFirst(session.label)}.`;
  return session.label.startsWith("Opens") ? `Market closed, ${lowerFirst(session.label)}.` : "Market closed. The next open is not known yet.";
}

/** The reader's settled record; a losing run is stated the way the Brake reads it ("lost the last 3"). */
export function recordLine({ settled, wins, losses, streak }: SenseiRecord): string {
  if (settled === 0) return "Their record: no settled rounds yet.";
  const count = (n: number) => (n === 1 ? "one" : String(n));
  const run = streak < 0 ? `, and lost the last ${count(-streak)}` : streak > 0 ? `, and won the last ${count(streak)}` : "";
  return `Their record: ${settled} settled, ${wins} won, ${losses} lost${run}.`;
}

export function positionLines(positions: readonly SenseiPosition[]): string[] {
  if (positions.length === 0) return ["Their open positions, just read: none."];
  return [
    "Their open positions, just read:",
    ...positions.map(
      (p) => `- ${p.asset} ${p.cadence} ${SIDE[p.side]}, staked ${centsText(p.stakeCents)}, worth ${centsText(p.markCents)} at last trade, closes in ${p.minsToClose} min`,
    ),
  ];
}

function reportDay(dateEt: string): string {
  return `${ET_WEEKDAY_SHORT[weekdayOfDate(dateEt)]} ${dateEt.slice(5)}`;
}

/** "Earnings within 14 days: NVDA reports Thu 09-17 after the close." */
export function earningsLine({ events, symbols }: EarningsTurn): string {
  if (events === null) return "The earnings calendar could not be read this turn. Do not guess report dates.";
  const wanted = new Set<string>(symbols);
  const upcoming = events
    .filter((event) => wanted.has(event.symbol) && DATE_ET.test(event.dateEt))
    .sort((a, b) => a.dateEt.localeCompare(b.dateEt))
    .slice(0, EARNINGS_MAX);
  if (upcoming.length === 0) return `No earnings report within ${EARNINGS_DAYS} days for ${symbols.join(", ")}.`;
  const reports = upcoming.map((event) => `${event.symbol} reports ${reportDay(event.dateEt)}${event.hour ? REPORT_HOUR[event.hour] : ""}`);
  return `Earnings within ${EARNINGS_DAYS} days: ${reports.join("; ")}.`;
}
