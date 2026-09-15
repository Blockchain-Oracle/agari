import { formatEtClock } from "@agari/core/market";
import { STATUS } from "./copy";
import { dueBoundarySec, divergenceCentiBps, formatCentiBps, gradeCrossCheck, gradeRelay, laneKind } from "./grade";
import { pipelineRow } from "./pipeline";
import type { StatusPipeline } from "./protocol";

/**
 * Relay freshness, print-source mix and cross-check rows from `status/prints` and `status/cross-checks`
 * (proof-analytics.md §1, §2.5). Pure over the index rows, so the thresholds can be checked on canned rows.
 */
export interface MixRow {
  symbol: string | null;
  cadence_sec: number;
  which: number | null;
  source: number | null;
  windows: number;
  max_record_lag_sec: number | null;
  last_source_ts_sec: string | null;
  missing_void: number;
}

export interface CheckRow {
  symbol: string | null;
  primary_e8: string;
  check_e8: string;
}

export interface PrintScope {
  nowSec: number;
  inSession: boolean;
  /** The latest session that has opened: today's in session, the previous one before the open. */
  session: { date: string; openSec: number };
  /** Roller lane states from ops `/session`, keyed `TSLA-5m`. */
  lanes: Readonly<Record<string, string>>;
  /** The relay's missed-slot counter and when that process started (ops `/health`). */
  relay: { missed: number; startedAt: string } | null;
}

export const CADENCES = [300, 900, 3_600] as const;
const RELAY_SOURCES = [
  { id: "relay:pyth", source: 1, label: STATUS.pipelines.relay.pyth },
  { id: "relay:redstone", source: 2, label: STATUS.pipelines.relay.redstone },
] as const;

const cadenceText = (cadenceSec: number) => `${cadenceSec / 60}m`;
const laneKey = (row: MixRow) => `${row.symbol}-${cadenceText(row.cadence_sec)}`;
const isPrimary = (row: MixRow) => row.which === 0 || row.which === 1;
const listed = (rows: readonly MixRow[]) => rows.filter((row) => row.symbol !== null);

/** A lane's own voids, counted once however many rows repeat them. */
function voidsByLane(rows: readonly MixRow[]): Map<string, number> {
  const voids = new Map<string, number>();
  for (const row of rows) voids.set(laneKey(row), row.missing_void);
  return voids;
}

const sum = (values: Iterable<number>) => [...values].reduce((total, value) => total + value, 0);

function offHoursDetail(scope: PrintScope, detail: string): string {
  return scope.inSession ? detail : STATUS.detail.lastSession(scope.session.date, detail);
}

export function relayRows(mix: readonly MixRow[], recent: readonly MixRow[], scope: PrintScope): StatusPipeline[] {
  return RELAY_SOURCES.map(({ id, source, label }) => {
    const own = listed(mix).filter((row) => row.source === source);
    const primary = own.filter(isPrimary);
    if (primary.length === 0) {
      return pipelineRow(id, label, { verdict: "good", detail: offHoursDetail(scope, STATUS.detail.relayNone), offHours: !scope.inSession });
    }
    const lastByLane = new Map<string, { cadenceSec: number; lastSec: number }>();
    for (const row of primary) {
      const lastSec = Number(row.last_source_ts_sec ?? 0);
      const seen = lastByLane.get(laneKey(row));
      if (!seen || lastSec > seen.lastSec) lastByLane.set(laneKey(row), { cadenceSec: row.cadence_sec, lastSec });
    }
    const primaryLanes = new Set(lastByLane.keys());
    const missingVoids = sum([...voidsByLane(listed(mix)).entries()].filter(([key]) => primaryLanes.has(key)).map(([, count]) => count));
    const throughSec = Math.max(...own.map((row) => Number(row.last_source_ts_sec ?? 0)));
    const lags = listed(recent).filter((row) => row.source === source && row.max_record_lag_sec !== null).map((row) => row.max_record_lag_sec as number);
    const recentLagSec = lags.length > 0 ? Math.max(...lags) : null;
    const behind = [...lastByLane.entries()]
      .filter(([key, lane]) => {
        const state = scope.lanes[key];
        const dueSec = dueBoundarySec(scope.nowSec, lane.cadenceSec);
        return state !== undefined && laneKind(state) === "open" && dueSec >= scope.session.openSec && lane.lastSec < dueSec;
      })
      .map(([key]) => key);
    const missed = scope.relay?.missed ?? 0;

    const parts = [STATUS.detail.relayLanes(primaryLanes.size), STATUS.detail.relayThrough(formatEtClock(throughSec))];
    if (scope.inSession && recentLagSec !== null) parts.push(STATUS.detail.relaySlowest(recentLagSec));
    if (missingVoids > 0) parts.push(STATUS.detail.missingVoids(missingVoids));
    if (scope.inSession && behind.length > 0) parts.push(STATUS.detail.relayBehind(behind));
    if (scope.inSession && missed > 0 && scope.relay) parts.push(STATUS.detail.relayMissed(missed, scope.relay.startedAt));
    const verdict = scope.inSession ? gradeRelay({ missingVoids, recentLagSec, behindLanes: behind.length, missed }) : "good";
    return pipelineRow(id, label, { verdict, detail: offHoursDetail(scope, parts.join(" · ")), lagSec: recentLagSec, offHours: !scope.inSession });
  });
}

/** "Pyth 3 · RedStone 6": distinct tickers per primary source for one cadence; any missing-print void is bad. */
export function mixRows(mix: readonly MixRow[], scope: PrintScope): StatusPipeline[] {
  return CADENCES.map((cadenceSec) => {
    const rows = listed(mix).filter((row) => row.cadence_sec === cadenceSec);
    const bySource = new Map<number, Set<string>>();
    for (const row of rows) {
      if (row.source === null || !isPrimary(row)) continue;
      bySource.set(row.source, (bySource.get(row.source) ?? new Set()).add(row.symbol as string));
    }
    const voids = sum(voidsByLane(rows).values());
    const text = [...bySource.entries()]
      .sort(([a], [b]) => a - b)
      .map(([source, symbols]) => `${STATUS.sources[source] ?? `source ${source}`} ${symbols.size}`)
      .join(" · ");
    const detail = rows.length === 0 ? STATUS.detail.mixNone : [text, voids > 0 ? STATUS.detail.missingVoids(voids) : ""].filter(Boolean).join(" · ");
    const verdict = scope.inSession && voids > 0 ? "bad" : "good";
    return pipelineRow(`mix:${cadenceText(cadenceSec)}`, STATUS.pipelines.mix(cadenceText(cadenceSec)), { verdict, detail: offHoursDetail(scope, detail), offHours: !scope.inSession });
  });
}

/** The largest primary-vs-check divergence in integer centi-bps; no pair at all is an honest single source. */
export function crossCheckRow(checks: readonly CheckRow[], scope: PrintScope): StatusPipeline {
  const label = STATUS.pipelines.crossCheck;
  const pairs = checks.filter((row) => row.symbol !== null);
  if (pairs.length === 0) {
    return pipelineRow("cross-check", label, { verdict: "good", detail: offHoursDetail(scope, STATUS.detail.singleSource), offHours: !scope.inSession });
  }
  let maxCentiBps = 0n;
  for (const pair of pairs) {
    const centiBps = divergenceCentiBps(BigInt(pair.primary_e8), BigInt(pair.check_e8));
    if (centiBps > maxCentiBps) maxCentiBps = centiBps;
  }
  const symbols = [...new Set(pairs.map((pair) => pair.symbol as string))].sort().join("/");
  const detail = STATUS.detail.crossCheck(symbols, pairs.length, formatCentiBps(maxCentiBps));
  const verdict = scope.inSession ? gradeCrossCheck(maxCentiBps) : "good";
  return pipelineRow("cross-check", label, { verdict, detail: offHoursDetail(scope, detail), offHours: !scope.inSession });
}
