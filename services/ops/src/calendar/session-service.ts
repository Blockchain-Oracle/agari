/**
 * The session calendar every venue actor reads (plan §4 window-roller; venue-ops.md §5.1): Alpaca ∩ Pyth schedule,
 * date by date. A disputed date becomes unknown, so nothing is listed on it. Refreshed hourly; on a failed refresh
 * the last agreed calendar is kept while it still covers today, and nothing is listed once it doesn't.
 */
import { addDays, agreeCalendars, etDateOf, sessionStatus, type SessionCalendar, type SessionDisagreement, type SessionStatus } from "@agari/core/market";
import { errorText } from "../runtime/env";
import { fetchAlpacaCalendar } from "./alpaca";
import { fetchPythSchedule } from "./pyth-schedule";

export interface SessionService {
  /** The agreed calendar, or null before the first successful refresh (list nothing). */
  calendar(): SessionCalendar | null;
  status(nowSec: number, halted?: boolean): SessionStatus | null;
  disagreements(): readonly SessionDisagreement[];
  /** Refreshes when stale (or when `force`); never throws. Returns a log-safe line. */
  refresh(force?: boolean): Promise<string>;
}

const REFRESH_MS = 60 * 60 * 1000;
const DAYS_BACK = 7;
const DAYS_AHEAD = 14;

export function createSessionService(options: { nowSec?: () => number } = {}): SessionService {
  const nowSec = options.nowSec ?? (() => Math.floor(Date.now() / 1000));
  let agreed: SessionCalendar | null = null;
  let disputed: SessionDisagreement[] = [];
  let fetchedMs = 0;
  let inflight: Promise<string> | null = null;

  const doRefresh = async (): Promise<string> => {
    const today = etDateOf(nowSec());
    const [from, to] = [addDays(today, -DAYS_BACK), addDays(today, DAYS_AHEAD)];
    try {
      const [alpaca, schedule] = await Promise.all([fetchAlpacaCalendar(from, to), fetchPythSchedule()]);
      const result = agreeCalendars(alpaca, schedule);
      agreed = result.calendar;
      disputed = result.disagreements;
      fetchedMs = Date.now();
      const sessions = agreed.sessions.filter((s) => s.date >= today).length;
      return `calendar ${from}..${to}: ${sessions} sessions ahead${disputed.length ? `, ${disputed.length} disputed dates listed as unknown: ${disputed.map((d) => d.date).join(" ")}` : ""}`;
    } catch (error) {
      if (agreed && agreed.toDate < today) agreed = null;
      return `calendar refresh failed (${agreed ? "keeping the last agreed calendar" : "no calendar: listing nothing"}): ${errorText(error)}`;
    }
  };

  return {
    calendar: () => agreed,
    status: (sec, halted) => (agreed ? sessionStatus(sec, agreed, { halted: halted ?? false }) : null),
    disagreements: () => disputed,
    refresh(force = false) {
      if (!force && agreed && Date.now() - fetchedMs < REFRESH_MS) return Promise.resolve("calendar fresh");
      inflight ??= doRefresh().finally(() => (inflight = null));
      return inflight;
    },
  };
}
