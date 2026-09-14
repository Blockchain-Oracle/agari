/**
 * `GET /session` (first-call.md §6): the agreed NYSE calendar's state now, the next sessions, and the roller's lane
 * states, so web can say "Opens Mon 09:30 ET" or "Paused: no signed price source" without its own calendar keys.
 */
import { sessionLabel } from "@agari/core/market";
import type { SessionService } from "../calendar/session-service";
import { heartbeats } from "../runtime/heartbeat";

const UPCOMING = 5;

export function sessionBody(sessions: SessionService | null, nowSec = Math.floor(Date.now() / 1000)) {
  const calendar = sessions?.calendar() ?? null;
  const status = sessions?.status(nowSec) ?? null;
  const roller = heartbeats().find((b) => b.actor === "window-roller");
  return {
    nowSec,
    status,
    label: status ? sessionLabel(status) : null,
    calendar: calendar
      ? {
          fromDate: calendar.fromDate,
          toDate: calendar.toDate,
          unknownDates: calendar.unknownDates,
          upcoming: calendar.sessions.filter((s) => s.closeSec > nowSec).slice(0, UPCOMING),
        }
      : null,
    lanes: (roller?.detail.lanes as Record<string, string> | undefined) ?? {},
  };
}
