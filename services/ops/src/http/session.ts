/**
 * `GET /session` (first-call.md §6): the agreed NYSE calendar's state now, the next sessions, and the roller's lane
 * states, so web can say "Opens Mon 09:30 ET" or "Paused: no signed price source" without its own calendar keys.
 * S5 adds `calendar.recent` and `sources`; S6 adds `halts`, `earnings` and `skips` (session-lanes.md §3, §6).
 */
import { readFileSync } from "node:fs";
import { addDays, etDateOf, sessionLabel } from "@agari/core/market";
import type { SessionService } from "../calendar/session-service";
import type { HaltBoardStore } from "../runtime/halt-board";
import { heartbeats } from "../runtime/heartbeat";
import type { PythEntitlementStore } from "../runtime/pyth-entitlement";
import type { SessionEvents } from "../runtime/session-events";

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

export interface SessionInputs {
  sessions: SessionService | null;
  halts: HaltBoardStore | null;
  events: SessionEvents | null;
  /** The valuation indices' live entitlement (S20); null in a process without the store. */
  pythIndex?: PythEntitlementStore | null;
}

/** `sources.pythIndex`: per pre-IPO name, what the key may read now — from the live store, never the config file. */
function pythIndexSources(store: PythEntitlementStore | null | undefined) {
  return Object.fromEntries((store?.feeds() ?? []).map((f) => [f.symbol, { state: f.state, status: f.status, checkedAtSec: f.checkedAtSec, reason: f.reason }]));
}

export function sessionBody({ sessions, halts, events, pythIndex }: SessionInputs, nowSec = Math.floor(Date.now() / 1000)) {
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
    sources: { pythTrialLastCloseSec: PYTH_TRIAL_LAST_CLOSE_SEC, pythIndex: pythIndexSources(pythIndex) },
    /** Halted lanes by asset (ticker, or xStock for the token lane); `{}` when nothing is halted. */
    halts: halts?.board() ?? {},
    /** Report dates 14 days ahead; null until the first fetch ("unknown", never "none"). */
    earnings: events?.earnings() ?? null,
    /** Corporate-action skips from three ET days back on: a Friday skip still pauses that weekend's Gap. */
    skips: (events?.skips() ?? []).filter((k) => k.date >= addDays(etDateOf(nowSec), -3)),
  };
}
