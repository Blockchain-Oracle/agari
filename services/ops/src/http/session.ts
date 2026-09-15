/**
 * `GET /session` (first-call.md §6): the agreed NYSE calendar's state now, the next sessions, and the roller's lane
 * states, so web can say "Opens Mon 09:30 ET" or "Paused: no signed price source" without its own calendar keys.
 */
import { readFileSync } from "node:fs";
import { sessionLabel } from "@agari/core/market";
import type { SessionService } from "../calendar/session-service";
import { heartbeats } from "../runtime/heartbeat";

const UPCOMING = 5;
const RECENT = 5;

/** The Pyth trial's last covered close (price-sources.json `pythTrial.lastCoveredClose`), for /status "sessions left" (proof-analytics.md §4). */
function pythTrialLastCloseSec(): number | null {
  try {
    const sources = JSON.parse(readFileSync(new URL("../../config/price-sources.json", import.meta.url), "utf8")) as { pythTrial?: { lastCoveredClose?: string } };
    const ms = Date.parse(sources.pythTrial?.lastCoveredClose ?? "");
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  } catch {
    return null;
  }
}
const PYTH_TRIAL_LAST_CLOSE_SEC = pythTrialLastCloseSec();

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
          recent: calendar.sessions.filter((s) => s.openSec <= nowSec).slice(-RECENT),
        }
      : null,
    lanes: (roller?.detail.lanes as Record<string, string> | undefined) ?? {},
    sources: { pythTrialLastCloseSec: PYTH_TRIAL_LAST_CLOSE_SEC },
  };
}
