/**
 * Canned NYSE sessions for the S6 state fixtures (session-lanes.md §5): the same `MarketSession` a live `/session` read
 * builds (`toMarketSession`), over an Alpaca-shaped calendar and fixed clocks, so a chip or a blocker renders here exactly
 * as it would on `/markets`.
 */
import { calendarFromAlpaca, corporatePausedState, datesBetween, haltPausedState, weekdayOfDate, type SessionCalendar } from "@agari/core/market";
import type { CorporateSkip, EarningsEvent, HaltBoard } from "@agari/core/types";
import { toMarketSession, type MarketSession } from "@/features/markets/session";

const HOLIDAYS = new Set(["2026-11-26"]);
const EARLY_CLOSES = new Set(["2026-11-27"]);

function calendar(from: string, to: string): SessionCalendar {
  const rows = datesBetween(from, to)
    .filter((date) => weekdayOfDate(date) < 5 && !HOLIDAYS.has(date))
    .map((date) => ({ date, open: "09:30", close: EARLY_CLOSES.has(date) ? "13:00" : "16:00" }));
  return calendarFromAlpaca(rows, from, to);
}

const SEPTEMBER = calendar("2026-09-14", "2026-09-30");
const THANKSGIVING = calendar("2026-11-23", "2026-12-04");

/** The clocks each state is read at (UTC seconds). */
export const CLOCK = {
  preTue: 1_789_473_600, // Tue 09-15 08:00 ET
  regularTue: 1_789_491_600, // Tue 09-15 13:00 ET
  postTue: 1_789_506_000, // Tue 09-15 17:00 ET
  listedWed: 1_789_592_400, // Wed 09-16 17:00 ET — the 09-18 Gap lists 48 h ahead
  weekendSat: 1_789_830_060, // Sat 09-19 11:01 ET — the Gap trades, the token lane runs
  lockedMon: 1_789_956_000, // Sun 09-20 22:00 ET — the Gap is locked
  settledMon: 1_789_999_200, // Mon 09-21 10:00 ET — the Gap settled on the 09:30:00 print
  holidayThu: 1_795_708_800, // Thanksgiving 11-26 11:00 ET
  earlyCloseFri: 1_795_795_200, // Fri 11-27 11:00 ET — closes 13:00
} as const;

export const LANES: Record<string, string> = {
  "TSLA-5m": "open → 1789491900",
  "TSLA-60m": "open → 1789495200",
  "NVDA-5m": corporatePausedState("4-for-1 split"),
  "AAPL-15m": haltPausedState({ reason: "redstone-stale", sinceSec: 0 }),
  "TSLA-gap": "open → 1789997400",
  "QQQ-gap": "paused: no signed source",
  "VOO-gap": "paused: no signed source",
  "TSLAx-5m": "open → 1789830300",
  "SPYx-5m": "paused: lane not built",
};

export const HALTS: HaltBoard = {
  TSLA: { reason: "pyth-wide", sinceSec: CLOCK.regularTue - 90 },
  AAPL: { reason: "redstone-stale", sinceSec: CLOCK.regularTue - 75 },
  TSLAx: { reason: "issuer-halt", sinceSec: CLOCK.weekendSat - 600 },
};

export const EARNINGS: EarningsEvent[] = [
  { symbol: "TSLA", dateEt: "2026-09-15", hour: "amc" },
  { symbol: "NVDA", dateEt: "2026-09-18", hour: "amc" },
  { symbol: "GOOGL", dateEt: "2026-09-21", hour: "bmo" },
];

export const SKIPS: CorporateSkip[] = [{ symbol: "NVDA", date: "2026-09-15", why: "4-for-1 split", lanes: ["regular"] }];

interface SessionOptions {
  halts?: HaltBoard;
  asset?: string;
}

/** A `MarketSession` at `nowSec`, optionally for one asset (its halt applies). Throws on a clock the calendars don't cover. */
export function fixtureSession(nowSec: number, { halts = {}, asset }: SessionOptions = {}): MarketSession {
  const cal = nowSec >= THANKSGIVING.sessions[0]!.openSec - 7 * 86_400 ? THANKSGIVING : SEPTEMBER;
  const session = toMarketSession({ lanes: LANES, halts, earnings: EARNINGS, skips: SKIPS }, cal, nowSec, asset);
  if (!session) throw new Error(`fixture calendar does not cover ${nowSec}`);
  return session;
}

/** Every §5 session state, labeled as the fixture page shows it. */
export const SESSION_STATES: ReadonlyArray<{ label: string; session: MarketSession; asset?: string }> = [
  { label: "pre — before the open", session: fixtureSession(CLOCK.preTue) },
  { label: "regular — in session", session: fixtureSession(CLOCK.regularTue) },
  { label: "early close — Black Friday", session: fixtureSession(CLOCK.earlyCloseFri) },
  { label: "halted — TSLA, pyth-wide", session: fixtureSession(CLOCK.regularTue, { halts: HALTS, asset: "TSLA" }), asset: "TSLA" },
  { label: "halted — AAPL, redstone-stale (Q-S6-9)", session: fixtureSession(CLOCK.regularTue, { halts: HALTS, asset: "AAPL" }), asset: "AAPL" },
  { label: "halted — TSLAx issuer halt, at the weekend", session: fixtureSession(CLOCK.weekendSat, { halts: HALTS, asset: "TSLAx" }), asset: "TSLAx" },
  { label: "post — after the close", session: fixtureSession(CLOCK.postTue) },
  { label: "closed — the weekend", session: fixtureSession(CLOCK.weekendSat) },
  { label: "holiday — Thanksgiving", session: fixtureSession(CLOCK.holidayThu) },
];
