import { BASKET_SYMBOLS, BASKETS, basketMembersHeld, ET_WEEKDAY_SHORT, isBasketCoverable, weekdayOfDate, type TickerSymbol } from "@agari/core/market";
import type { EarningsEvent } from "@/lib/finnhub.server";
import type { SenseiDesk, SenseiHolding, SenseiPosition, SenseiRecord, SenseiSession } from "./protocol";
import { centsText } from "./units";

/**
 * The per-turn lines Sensei's server adds about the session, the reader's own book and earnings (S13 spec §1.1).
 *
 * Pure strings over the request, so the route stays a transport and the whole block can be measured: it has to stay
 * under 2.5 KB with eight positions, four Windows, four holdings and the full earnings list, because it rides on every
 * turn (2 KB before the holdings line; D-104).
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

const ISSUER = { xstocks: "xStocks", ondo: "Ondo", prestocks: "PreStocks" } as const;

/**
 * What the wallet holds, stated as a fact with its one allowed use: a Window on the same name is cover, with test
 * funds. The token itself stays behind the advice line in the system prompt; this line only reminds the model of it.
 */
export function holdingsLine(holdings: readonly SenseiHolding[]): string {
  if (holdings.length === 0) return "Their wallet holds no stock tokens (real tokens, read-only).";
  const rows = holdings.map((h) => `${h.tokens} ${h.symbol} (${h.name}, ${ISSUER[h.issuer]})${h.valueCents === null ? "" : ` about ${centsText(h.valueCents)}`}`);
  return `Their wallet holds, real tokens read-only, not test funds: ${rows.join("; ")}. A DOWN Window on that name is cover with test funds; UP adds to it.${basketCoverLine(holdings)} Never advise on the tokens themselves.`;
}

/**
 * S19: two or more held members of one basket can be covered together. A PreStocks holding's symbol is the member's
 * ticker itself, so the registry answers which baskets the wallet could cover; nothing else is inferred.
 */
export function basketCoverLine(holdings: readonly SenseiHolding[]): string {
  const held = new Set(holdings.filter((h) => h.issuer === "prestocks").map((h) => h.symbol));
  const coverable = BASKET_SYMBOLS.map((s) => BASKETS[s]).filter((b) => isBasketCoverable(b, held));
  if (coverable.length === 0) return "";
  const parts = coverable.map((b) => `${b.symbol} (${b.name}: they hold ${basketMembersHeld(b, held).length} of its ${b.members.length} members)`);
  return ` A DOWN Window on a basket covers the members they hold together: ${parts.join("; ")}.`;
}

const DESK_MODE = { practice: "in practice, spending nothing", ask_first: "live, asking before every action", on_its_own: "live, acting inside its limits" } as const;

/**
 * S21 (plan §5.2): the reader's desk as a fact and its one allowed use: Sensei explains from the record and points to
 * the control that changes things; it never acts, and every change is a card the owner confirms on /desk.
 */
export function deskLine(desk: SenseiDesk): string {
  const worth = desk.valueCents === null ? "not valued yet" : `worth ${centsText(desk.valueCents)}`;
  const last = desk.lastDecision === null ? "no decision yet" : `last decision ${desk.lastDecisionAgoMin === null ? "" : `${desk.lastDecisionAgoMin} min ago: `}"${desk.lastDecision}"`;
  const waiting = desk.waiting === null ? "Nothing is waiting for their answer." : `Waiting for their answer: "${desk.waiting}".`;
  return `Their desk (real PreStocks tokens on Solana mainnet, ${DESK_MODE[desk.mode]}, ${desk.state}, ${desk.practiceChecks} practice checks): ${worth}; ${last}. ${waiting} Explain the desk only from that record; you cannot act on it, and any change is a card they confirm themselves on the desk page.`;
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
