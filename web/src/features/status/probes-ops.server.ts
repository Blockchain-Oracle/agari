import { etDateOf, formatEtClock } from "@agari/core/market";
import { STATUS } from "./copy";
import { gradeHeartbeat, gradeIndexer, gradeLanes, gradeTrial, laneKind, trialSessionsLeft } from "./grade";
import { detailNumber, detailString, heartbeatOf, type OpsHealth, type OpsPythIndexEntitlement, type OpsRead, type OpsSession } from "./ops.server";
import { pipelineRow } from "./pipeline";
import type { StatusPipeline } from "./protocol";

/** Rows answered entirely from ops `/health` and `/session` (proof-analytics.md §2.5): no read of their own. */
export interface OpsRows {
  health: OpsRead<OpsHealth>;
  session: OpsRead<OpsSession>;
  inSession: boolean;
}

export function indexerRow({ health, inSession }: OpsRows): StatusPipeline {
  const label = STATUS.pipelines.indexer;
  if (!health.ok) return pipelineRow("indexer", label, { verdict: "bad", detail: health.why, latencyMs: health.latencyMs });
  const beat = heartbeatOf(health.value, "indexer");
  if (!beat) return pipelineRow("indexer", label, { verdict: "bad", detail: STATUS.detail.noBeat("indexer") });
  const gapsOpen = detailNumber(beat, "gapsOpen") ?? 0;
  const lastLagSec = detailNumber(beat, "lastLagSec");
  const subscription = detailString(beat, "subscription");
  const verdict = gradeIndexer({ subscription, lastLagSec, gapsOpen, failures: beat.failures }, inSession);
  const parts = [STATUS.detail.indexer(subscription ?? "unknown", detailNumber(beat, "txs") ?? 0, detailNumber(beat, "fills") ?? 0, detailNumber(beat, "cursorSlot"))];
  if (gapsOpen > 0) parts.push(STATUS.detail.gaps(gapsOpen));
  if (beat.failures > 0) parts.push(STATUS.detail.failures(beat.failures));
  return pipelineRow("indexer", label, { verdict, detail: parts.join(" · "), lagSec: lastLagSec, offHours: !inSession });
}

/** The six ops actors: failing or silent is bad in or out of session; only the seed maker rests off-hours. */
export function heartbeatRows({ health, inSession }: OpsRows): StatusPipeline[] {
  return STATUS.actors.map(({ id, actor, name }) => {
    const rowId = `ops:${id}`;
    const label = STATUS.pipelines.ops(name);
    if (!health.ok) return pipelineRow(rowId, label, { verdict: "bad", detail: health.why, latencyMs: health.latencyMs });
    const beat = heartbeatOf(health.value, actor);
    if (!beat) return pipelineRow(rowId, label, { verdict: "bad", detail: STATUS.detail.noBeat(actor) });
    const { verdict, lagSec } = gradeHeartbeat(beat, health.value.nowMs);
    const resting = actor === "seed-maker" && !inSession;
    return pipelineRow(rowId, label, { verdict, lagSec, detail: STATUS.detail.beat(beat.lastWhy, beat.failures), offHours: resting });
  });
}

/** Lane states grouped by kind, open first: "25 open · 2 paused: no signed source (QQQ-5m, VOO-5m)". */
function laneGroups(lanes: Readonly<Record<string, string>>): string {
  const groups = new Map<string, string[]>();
  for (const [key, state] of Object.entries(lanes)) {
    const kind = laneKind(state);
    groups.set(kind, [...(groups.get(kind) ?? []), key]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === "open" ? -1 : b === "open" ? 1 : a.localeCompare(b)))
    .map(([kind, keys]) => (kind === "open" || kind.startsWith("closed") ? `${keys.length} ${kind}` : `${keys.length} ${kind} (${keys.join(", ")})`))
    .join(" · ");
}

export function lanesRow({ session, inSession }: OpsRows): StatusPipeline {
  const label = STATUS.pipelines.paused;
  if (!session.ok) return pipelineRow("paused", label, { verdict: "bad", detail: session.why, latencyMs: session.latencyMs });
  const states = Object.values(session.value.lanes);
  if (states.length === 0) return pipelineRow("paused", label, { verdict: "bad", detail: STATUS.detail.noLanes });
  const detail = STATUS.detail.lanes(states.length, laneGroups(session.value.lanes));
  return pipelineRow("paused", label, { verdict: inSession ? gradeLanes(states) : "good", detail, latencyMs: session.latencyMs, offHours: !inSession });
}

/** Not session-bound: the trial runs out by the calendar whether or not the market is open now. */
export function pythTrialRow({ session }: OpsRows): StatusPipeline {
  const label = STATUS.pipelines.pythTrial;
  if (!session.ok) return pipelineRow("pyth-trial", label, { verdict: "bad", detail: session.why, latencyMs: session.latencyMs });
  const { nowSec, sources, calendar } = session.value;
  const lastCloseSec = sources.pythTrialLastCloseSec;
  if (lastCloseSec === null || !calendar) return pipelineRow("pyth-trial", label, { verdict: "warn", detail: STATUS.detail.trialUnknown });
  const trial = trialSessionsLeft(nowSec, lastCloseSec, calendar.upcoming);
  const detail = trial.ended ? STATUS.detail.trialEnded : STATUS.detail.trialLeft(trial.left, trial.capped, `${etDateOf(lastCloseSec)} ${formatEtClock(lastCloseSec)}`);
  return pipelineRow("pyth-trial", label, { verdict: gradeTrial(trial), detail });
}

const utcClock = (sec: number) => `${new Date(sec * 1000).toISOString().slice(11, 16)} UTC`;

/**
 * S20 (D-125): whether the venue's key may read Pyth's valuation indices, from ops' live probe. Good when every index
 * is entitled; warn while any is denied or unknown ("OPENAI, ANTHROPIC: not entitled (403 pyth-indices)"), because the
 * valuation lanes simply do not list; bad only when ops cannot be read. Not session-bound: the index is 24/7.
 */
export function pythIndexRow({ session }: OpsRows): StatusPipeline {
  const label = STATUS.pipelines.pythIndex;
  if (!session.ok) return pipelineRow("pyth-index", label, { verdict: "bad", detail: session.why, latencyMs: session.latencyMs });
  const entries = Object.entries(session.value.sources.pythIndex);
  if (entries.length === 0) return pipelineRow("pyth-index", label, { verdict: "warn", detail: STATUS.detail.pythIndexNone, latencyMs: session.latencyMs });
  const entitled = entries.filter(([, e]) => e.state === "entitled").map(([name]) => name);
  const other = entries.filter(([, e]) => e.state !== "entitled");
  const reasonOf = (e: OpsPythIndexEntitlement) => (e.status || e.reason ? [e.status, e.reason].filter(Boolean).join(" ") : null);
  const parts: string[] = [];
  if (entitled.length) parts.push(STATUS.detail.pythIndexEntitled(entitled.join(", ")));
  if (other.length) parts.push(STATUS.detail.pythIndexDenied(other.map(([name]) => name).join(", "), reasonOf(other[0]![1])));
  const probedSec = Math.max(...entries.map(([, e]) => e.checkedAtSec ?? 0));
  parts.push(probedSec > 0 ? STATUS.detail.pythIndexProbed(utcClock(probedSec)) : STATUS.detail.pythIndexUnprobed);
  return pipelineRow("pyth-index", label, { verdict: other.length ? "warn" : "good", detail: parts.join(" · "), latencyMs: session.latencyMs });
}
