import { formatUtc, secToMs } from "@agari/core/units";
import { printArchiveStats, statusReader, type Db, type PrintArchiveStat } from "@agari/db";
import { STATUS } from "./copy";
import { createDiagnosticRunner } from "./diagnostic-runner";
import { gradeArchive, gradeSlotLag, worst, type Verdict } from "./grade";
import { detailNumber, heartbeatOf, type OpsHealth, type OpsRead } from "./ops.server";
import { errorText, pipelineRow } from "./pipeline";
import type { StatusPipeline } from "./protocol";
import { CADENCES, crossCheckRow, mixRows, relayRows, type CheckRow, type MixRow, type PrintScope } from "./rows-prints";

/**
 * The index and archive rows of `/status` (proof-analytics.md §2.5): slots behind head, relay freshness, print-source
 * mix, cross-check agreement and the RedStone archive. One run makes at most five index-backed queries, in parallel.
 */
const diagnose = createDiagnosticRunner(10_000);
/** Relay record lag is judged over Windows opened in the last 15 minutes: a status, not a session report. */
const RECENT_LOOK_SEC = 900;
/** Consecutive spot-feed failures that turn the RedStone row amber in session. */
const SPOT_FAILING = 3;

export interface IndexProbeInput {
  db: Db | null;
  rpcSlot: number | null;
  health: OpsRead<OpsHealth>;
  /** Null when ops could not say which session prints belong to. */
  scope: PrintScope | null;
  /** Why `scope` is null. */
  scopeWhy: string;
}

export interface IndexRows {
  slotLag: StatusPipeline;
  relays: StatusPipeline[];
  mixes: StatusPipeline[];
  crossCheck: StatusPipeline;
  redstone: StatusPipeline;
}

const RELAY_IDS = [
  ["relay:pyth", STATUS.pipelines.relay.pyth],
  ["relay:redstone", STATUS.pipelines.relay.redstone],
] as const;

/** Every row this probe owns, answering the same failure (no database, no session scope, a failed read). */
function allDown(detail: string, latencyMs: number | null = null): Omit<IndexRows, "slotLag"> {
  const down = (id: string, label: string) => pipelineRow(id, label, { verdict: "bad", detail, latencyMs });
  return {
    relays: RELAY_IDS.map(([id, label]) => down(id, label)),
    mixes: CADENCES.map((cadenceSec) => down(`mix:${cadenceSec / 60}m`, STATUS.pipelines.mix(`${cadenceSec / 60}m`))),
    crossCheck: down("cross-check", STATUS.pipelines.crossCheck),
    redstone: down("redstone", STATUS.pipelines.redstone),
  };
}

async function slotLagRow(db: Db, rpcSlot: number | null, inSession: boolean): Promise<StatusPipeline> {
  const label = STATUS.pipelines.slotLag;
  const offHours = !inSession;
  try {
    const { value: head, elapsedMs } = await diagnose("status:head", ({ step }) => step("Index head", () => statusReader(db).head()));
    if (head.last_slot === null) return pipelineRow("slot-lag", label, { verdict: inSession ? "warn" : "good", detail: STATUS.detail.slotEmpty, latencyMs: elapsedMs, offHours });
    if (rpcSlot === null) return pipelineRow("slot-lag", label, { verdict: inSession ? "bad" : "good", detail: STATUS.detail.noHead, latencyMs: elapsedMs, offHours });
    const slots = Math.max(0, rpcSlot - Number(head.last_slot));
    const lastAt = head.last_block_time_sec === null ? "—" : formatUtc(secToMs(Number(head.last_block_time_sec)), { withDate: !inSession });
    return pipelineRow("slot-lag", label, { verdict: inSession ? gradeSlotLag(slots) : "good", detail: STATUS.detail.slotLag(slots, lastAt), latencyMs: elapsedMs, offHours });
  } catch (error) {
    return pipelineRow("slot-lag", label, { verdict: "bad", detail: errorText(error) });
  }
}

function archiveReading(stats: readonly PrintArchiveStat[]): { verdict: Verdict; text: string } {
  if (stats.length === 0) return { verdict: "good", text: STATUS.detail.archiveNone };
  const evidence = {
    maxFetchLagMs: Math.max(...stats.map((stat) => stat.maxFetchLagMs)),
    minSigners: Math.min(...stats.map((stat) => stat.minSigners)),
    lateCount: stats.reduce((total, stat) => total + stat.lateCount, 0),
  };
  const fetchSec = Math.floor((evidence.maxFetchLagMs + 500) / 1000);
  return { verdict: gradeArchive(evidence), text: STATUS.detail.archive(stats.length, fetchSec, evidence.minSigners, evidence.lateCount) };
}

async function redstoneRow(scope: PrintScope, health: OpsRead<OpsHealth>): Promise<StatusPipeline> {
  const label = STATUS.pipelines.redstone;
  const offHours = !scope.inSession;
  const spot = health.ok ? heartbeatOf(health.value, "spot-feed") : null;
  const spotNote = spot && spot.failures > 0 ? STATUS.detail.spot(spot.lastWhy) : null;
  try {
    const { value, elapsedMs } = await diagnose(`status:archive:${scope.session.openSec}`, ({ step }) => step("RedStone archive", () => printArchiveStats(scope.session.openSec)));
    const archive = archiveReading((value ?? []).filter((stat) => stat.source === "redstone"));
    const text = scope.inSession ? archive.text : STATUS.detail.lastSession(scope.session.date, archive.text);
    const detail = [text, spotNote].filter(Boolean).join(" · ");
    const verdict = scope.inSession ? worst(archive.verdict, (spot?.failures ?? 0) >= SPOT_FAILING ? "warn" : "good") : "good";
    return pipelineRow("redstone", label, { verdict, detail, latencyMs: elapsedMs, offHours });
  } catch (error) {
    return pipelineRow("redstone", label, { verdict: "bad", detail: errorText(error) });
  }
}

async function printRows(db: Db, scope: PrintScope): Promise<Pick<IndexRows, "relays" | "mixes" | "crossCheck">> {
  const reader = statusReader(db);
  const openSec = scope.session.openSec;
  const recentFromSec = Math.max(openSec, scope.nowSec - RECENT_LOOK_SEC);
  try {
    const { value } = await diagnose(`status:prints:${openSec}:${scope.inSession ? recentFromSec : "-"}`, ({ step }) =>
      step("Print mix and cross-checks", () =>
        Promise.all([reader.printMix(openSec), scope.inSession ? reader.printMix(recentFromSec) : Promise.resolve([]), reader.crossChecks(openSec)]),
      ),
    );
    const [mix, recent, checks]: [MixRow[], MixRow[], CheckRow[]] = value;
    return { relays: relayRows(mix, recent, scope), mixes: mixRows(mix, scope), crossCheck: crossCheckRow(checks, scope) };
  } catch (error) {
    const { relays, mixes, crossCheck } = allDown(errorText(error));
    return { relays, mixes, crossCheck };
  }
}

export async function probeIndex(input: IndexProbeInput): Promise<IndexRows> {
  const inSession = input.scope?.inSession ?? true;
  if (!input.db) return { slotLag: pipelineRow("slot-lag", STATUS.pipelines.slotLag, { verdict: "bad", detail: STATUS.detail.noDb }), ...allDown(STATUS.detail.noDb) };
  const slotLag = slotLagRow(input.db, input.rpcSlot, inSession);
  if (!input.scope) return { slotLag: await slotLag, ...allDown(input.scopeWhy) };
  const [prints, redstone] = await Promise.all([printRows(input.db, input.scope), redstoneRow(input.scope, input.health)]);
  return { slotLag: await slotLag, ...prints, redstone };
}

/** The relay's missed-slot counter and start, for the freshness rows. */
export function relayCounters(health: OpsRead<OpsHealth>): PrintScope["relay"] {
  if (!health.ok) return null;
  const beat = heartbeatOf(health.value, "price-relay");
  if (!beat) return null;
  return { missed: detailNumber(beat, "missed") ?? 0, startedAt: formatUtc(beat.startedMs) };
}
