import { sessionAt, sessionOnDate, type SessionCalendar, type TradingSession } from "./calendar";
import { datesBetween, ET_TIME_ZONE, MIN_PER_DAY, parseClockMinutes, weekdayOfDate } from "./et-time";

/** A half-open range of minutes after local midnight, `[startMin, endMin)`; `endMin` may be 1440. */
export interface MinuteRange {
  startMin: number;
  endMin: number;
}

/** A day's hours: `[]` is closed (`C`), `[{0, 1440}]` is open all day (`O`). */
export type DayHours = readonly MinuteRange[];

/**
 * A parsed Pyth feed `schedule` string: `TZ;Mon,Tue,Wed,Thu,Fri,Sat,Sun;MMDD/hours,...`.
 * Example (live `Equity.US.TSLA/USD`, 2026-09-14):
 * `America/New_York;0930-1600,0930-1600,0930-1600,0930-1600,0930-1600,C,C;0907/C,1126/C,1127/0930-1300,…`
 *
 * Overrides carry no year: Pyth publishes a rolling ~12-month list, so `0907/C` (Labor Day 2026) also
 * matches 2027-09-07. Only trust a schedule for dates within the year ahead of when it was fetched;
 * the Alpaca agreement check turns any stale override into "list nothing" rather than a wrong session.
 */
export interface PythSchedule {
  timeZone: string;
  /** Monday first, seven entries. */
  weekly: readonly DayHours[];
  /** Keyed by `MMDD`. */
  overrides: ReadonlyMap<string, DayHours>;
}

/** What a schedule says about one date, in terms the calendar can compare. */
export type PythDay =
  | { kind: "closed" }
  | { kind: "session"; session: TradingSession }
  /** Open all day or in several ranges: not a single regular session, so it can never agree with Alpaca. */
  | { kind: "irregular"; hours: DayHours };

function parseDayHours(entry: string): DayHours {
  if (entry === "C") return [];
  if (entry === "O") return [{ startMin: 0, endMin: MIN_PER_DAY }];
  const ranges = entry.split("&").map((range) => {
    const m = /^(\d{4})-(\d{4})$/.exec(range);
    if (!m) throw new Error(`bad schedule range: ${range}`);
    const startMin = parseClockMinutes(m[1]!);
    const endMin = parseClockMinutes(m[2]!);
    if (endMin <= startMin) throw new Error(`schedule range ends before it starts: ${range}`);
    return { startMin, endMin };
  });
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i]!.startMin < ranges[i - 1]!.endMin) throw new Error(`schedule ranges overlap: ${entry}`);
  }
  return ranges;
}

/** Parses a Pyth `schedule` attribute. Throws on anything malformed; a caller that can't parse lists nothing. */
export function parsePythSchedule(schedule: string): PythSchedule {
  const [timeZone, weeklyPart, overridesPart, ...rest] = schedule.split(";");
  if (!timeZone || weeklyPart === undefined || rest.length > 0) throw new Error("schedule must be TZ;weekly[;overrides]");
  const weeklyEntries = weeklyPart.split(",");
  if (weeklyEntries.length !== 7) throw new Error(`schedule needs 7 weekly entries, got ${weeklyEntries.length}`);
  const overrides = new Map<string, DayHours>();
  for (const item of overridesPart ? overridesPart.split(",") : []) {
    const m = /^(\d{2})(\d{2})\/(.+)$/.exec(item);
    const month = Number(m?.[1]);
    const day = Number(m?.[2]);
    if (!m || month < 1 || month > 12 || day < 1 || day > 31) throw new Error(`bad schedule override: ${item}`);
    overrides.set(`${m[1]}${m[2]}`, parseDayHours(m[3]!));
  }
  return { timeZone, weekly: weeklyEntries.map(parseDayHours), overrides };
}

/** The hours that apply on a calendar date: its `MMDD` override, else its weekday. */
export function pythHoursOn(schedule: PythSchedule, date: string): DayHours {
  return schedule.overrides.get(date.slice(5, 7) + date.slice(8, 10)) ?? schedule.weekly[weekdayOfDate(date)]!;
}

export function pythDayOn(schedule: PythSchedule, date: string): PythDay {
  if (schedule.timeZone !== ET_TIME_ZONE) throw new Error(`only ${ET_TIME_ZONE} schedules are supported, got ${schedule.timeZone}`);
  const hours = pythHoursOn(schedule, date);
  if (hours.length === 0) return { kind: "closed" };
  const only = hours[0]!;
  if (hours.length > 1 || (only.startMin === 0 && only.endMin === MIN_PER_DAY)) return { kind: "irregular", hours };
  return { kind: "session", session: sessionAt(date, only.startMin, only.endMin) };
}

/** Regular single-range sessions a schedule implies over `[fromDate, toDate]`. */
export function sessionsFromPythSchedule(schedule: PythSchedule, fromDate: string, toDate: string): TradingSession[] {
  return datesBetween(fromDate, toDate).flatMap((date) => {
    const day = pythDayOn(schedule, date);
    return day.kind === "session" ? [day.session] : [];
  });
}

export interface SessionDisagreement {
  date: string;
  alpaca: TradingSession | null;
  pyth: PythDay;
}

export interface CalendarAgreement {
  /** Alpaca's calendar with every disputed date moved to `unknownDates`. */
  calendar: SessionCalendar;
  disagreements: SessionDisagreement[];
}

function sameSession(a: TradingSession, b: TradingSession): boolean {
  return a.openSec === b.openSec && a.closeSec === b.closeSec;
}

/**
 * Alpaca ∩ Pyth, date by date (plan §4 window-roller). A date is kept only when both say closed, or
 * both give the same open and close. Anything else becomes unknown, so the roller lists nothing on it.
 */
export function agreeCalendars(alpaca: SessionCalendar, schedule: PythSchedule): CalendarAgreement {
  const disagreements: SessionDisagreement[] = [];
  for (const date of datesBetween(alpaca.fromDate, alpaca.toDate)) {
    const ours = sessionOnDate(alpaca, date);
    if (ours === undefined) continue;
    const pyth = pythDayOn(schedule, date);
    const agrees = ours === null ? pyth.kind === "closed" : pyth.kind === "session" && sameSession(ours, pyth.session);
    if (!agrees) disagreements.push({ date, alpaca: ours, pyth });
  }
  const disputed = new Set(disagreements.map((d) => d.date));
  const calendar: SessionCalendar = {
    fromDate: alpaca.fromDate,
    toDate: alpaca.toDate,
    sessions: alpaca.sessions.filter((s) => !disputed.has(s.date)),
    unknownDates: [...alpaca.unknownDates, ...disputed].sort(),
  };
  return { calendar, disagreements };
}
