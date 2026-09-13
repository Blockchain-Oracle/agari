import { decideAgentWindow, missingCredentialHint, promptHashOf, resolveModel, type ResolvedModel } from "@masayume/brain";
import { formatCadence } from "@masayume/core/copy";
import { phase } from "@masayume/core/lifecycle";
import { isOk } from "@masayume/core/schemas";
import { agentPrompt, decisionSlot, gateAgentVerdict, type AgentSpec, type StrategyRecord } from "@masayume/core/strategies";
import type { Bytes32, EventMarket } from "@masayume/core/types";
import { msToSec } from "@masayume/core/units";
import { beginStrategyDecision, getStrategyDecision, listStrategyDecisions, recordStrategyDecision } from "@masayume/db";
import { marketsProvider } from "@masayume/markets";
import { readAgentContext } from "@masayume/markets/strategies";
import { readAgentRecord, settlementReader } from "./agent-record";
import type { Scan } from "./decide";
import type { RunnerEnv } from "./env";

const HOUR_MS = 3_600_000;
const WARM_ROWS = 500;
/** A read is remembered until its Window is a day gone; after that the pair can never recur anyway. */
const FORGET_AFTER_SEC = 86_400;

/** The brain and the memory the agent scan carries between cycles. */
export interface AgentState {
  brain: ResolvedModel | null;
  /** Which variable would switch the brain on — the heartbeat names it. */
  missing: string;
  /** `${strategyId}:${marketId}` → the Window's expiry, for every Window already read. */
  read: Map<string, number>;
  /** When each model call was made, for the sliding-hour budget. */
  callsAtMs: number[];
}

export function createAgentState(): AgentState {
  return { brain: resolveModel(), missing: missingCredentialHint(), read: new Map(), callsAtMs: [] };
}

/** The boot line: the model by name and route, or exactly what is missing. Never a key. */
export function agentBootLine(state: AgentState): string {
  return state.brain ? `agent brain: ${state.brain.providerName}/${state.brain.modelId} via ${state.brain.via}` : `agent brain not configured: set ${state.missing}`;
}

/** Warms the "already read" set from the store, so a restart mid-Window does not ask the model twice. */
export async function warmAgentState(state: AgentState, nowSec: number): Promise<number> {
  const rows = await listStrategyDecisions(null, WARM_ROWS, true).catch(() => null);
  for (const row of rows ?? []) state.read.set(`${row.strategyId}:${row.marketId}`, Math.floor(row.decidedAtMs / 1000) + FORGET_AFTER_SEC);
  state.callsAtMs = (rows ?? []).map((row) => row.decidedAtMs).filter((at) => nowSec * 1000 - at < HOUR_MS);
  forget(state, nowSec);
  return rows?.length ?? 0;
}

function forget(state: AgentState, nowSec: number): void {
  for (const [key, untilSec] of state.read) if (untilSec < nowSec) state.read.delete(key);
}

/** One model call under the sliding-hour budget, or false: the Window is then held, not read. */
export function takeCall(state: AgentState, maxPerHour: number, nowMs: number): boolean {
  state.callsAtMs = state.callsAtMs.filter((at) => nowMs - at < HOUR_MS);
  if (state.callsAtMs.length >= maxPerHour) return false;
  state.callsAtMs.push(nowMs);
  return true;
}

export interface AgentRunner {
  env: RunnerEnv;
  venueId: Bytes32;
  runnerKey: string;
  agent: AgentState;
  log: (why: string) => void;
  onReading?: (why: string) => Promise<void>;
}

function label(market: EventMarket): string {
  return `${market.asset}/${formatCadence(market.intervalSec)}`;
}

/**
 * One read of the venue for an agent strategy: every Trading Window on one of its cadences, inside
 * its decision slot and not yet read, costs one model call under the hourly budget and writes one
 * decision row. The same `Scan` shape as the house model's, so the execution loop does not know
 * which brain decided. Reads only — the model never touches signing.
 */
export async function scanVenueWithAgent(runner: AgentRunner, strategy: StrategyRecord, spec: AgentSpec, nowMs: number): Promise<Scan> {
  const { agent, env, log } = runner;
  const brain = agent.brain;
  if (!brain) return { candidates: [], scanned: 0, closestBps: null, why: `agent brain not configured — set ${agent.missing} on the runner; holding` };
  const nowSec = msToSec(nowMs);
  forget(agent, nowSec);
  const lanes = await marketsProvider.listLiveLanes(runner.venueId);
  if (!isOk(lanes) || lanes.stale) return { candidates: [], scanned: 0, closestBps: null, why: `lanes unreadable: ${isOk(lanes) ? "stale state" : lanes.error.technical}` };
  const markets = lanes.value.lanes.flatMap((lane) => lane.markets).filter((m) => spec.cadences.includes(m.intervalSec) && phase(m, nowMs) === "trading");
  const settlementOf = settlementReader();
  const candidates: Scan["candidates"] = [];
  const notes: string[] = [];
  let reads = 0;

  for (const market of markets) {
    const key = `${strategy.strategyId}:${market.marketId}`;
    const slot = decisionSlot(market, nowMs);
    if (!slot.open) {
      notes.push(`${label(market)}: ${nowSec < slot.opensAtSec ? `slot opens in ${slot.opensAtSec - nowSec}s` : "slot closed"}`);
      continue;
    }
    const context = await readAgentContext(market, strategy.envelope.maxStakePerTradeBase, nowMs);
    if (!isOk(context) || context.stale) {
      notes.push(`${label(market)}: ${isOk(context) ? "stale context; holding" : context.error.technical}`);
      continue;
    }
    const record = await readAgentRecord(strategy.strategyId, nowSec, env.dryRun, settlementOf);
    const previous = await getStrategyDecision(strategy.strategyId.toString(), market.marketId, env.dryRun);
    if (previous) {
      // A held/failed read stays held for its Window. Only unfinished execution of a recorded
      // trade can resume; each subscriber still needs its own durable attempt reservation.
      if (previous.gate !== "trade" || !previous.side) {
        notes.push(`${label(market)}: ${previous.gateReason}`);
        continue;
      }
      // Reuse the recorded trade verdict, but check today's risk and quote before execution.
      const verdict = previous.verdictSide === "none" || previous.confidence === null ? null : { side: previous.verdictSide, confidence: previous.confidence, why: previous.why };
      const decision = gateAgentVerdict({ verdict, failure: previous.gateReason, spec, context: context.value, record, envelope: strategy.envelope, nowSec });
      if (decision.side) candidates.push({ market, decision });
      else notes.push(`${label(market)}: ${decision.reason}`);
      continue;
    }
    if (agent.callsAtMs.filter((at) => nowMs - at < HOUR_MS).length >= env.agentMaxCallsPerHour) {
      notes.push(`${label(market)}: call budget spent (${env.agentMaxCallsPerHour}/h); holding`);
      continue;
    }
    const claim = await beginStrategyDecision({ strategyId: strategy.strategyId.toString(), marketId: market.marketId, runner: runner.runnerKey, model: `${brain.providerName}/${brain.modelId}`, promptHash: promptHashOf(agentPrompt(spec, context.value, record)), dryRun: env.dryRun });
    if (claim !== "acquired") {
      notes.push(`${label(market)}: read already reserved; holding`);
      continue;
    }
    takeCall(agent, env.agentMaxCallsPerHour, nowMs);
    log(`#${strategy.strategyId}: reading ${label(market)}`);
    await runner.onReading?.(`reading ${label(market)}; awaiting the model's verdict`);
    const result = await decideAgentWindow({ spec, context: context.value, record, envelope: strategy.envelope, nowSec, model: brain.model, timeoutMs: env.agentTimeoutMs });
    agent.read.set(key, market.expirySec + FORGET_AFTER_SEC);
    reads += 1;
    const { read, decision } = result;
    const stored = await recordStrategyDecision({
      strategyId: strategy.strategyId.toString(),
      marketId: market.marketId,
      runner: runner.runnerKey,
      model: read.ok ? read.modelId : `${brain.providerName}/${brain.modelId}`,
      promptHash: result.promptHash,
      verdictSide: read.ok ? read.verdict.side : "none",
      confidence: read.ok ? read.verdict.confidence : null,
      why: read.ok ? read.verdict.why : read.detail,
      gate: decision.side ? "trade" : read.ok ? "held" : "failed",
      gateReason: decision.reason,
      side: decision.side,
      dryRun: env.dryRun,
    }).catch((error: unknown) => {
      log(`#${strategy.strategyId}: decision not stored: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    });
    if (!stored) throw new Error("risk memory unavailable: decision could not be stored; holding");
    const said = read.ok ? `read ${read.verdict.side} (${read.verdict.confidence.toFixed(2)}) — "${read.verdict.why}"` : `read failed: ${read.failure} — ${read.detail}`;
    log(`#${strategy.strategyId}: ${label(market)} ${said}; gate: ${decision.side ? `trade ${decision.side}` : "hold"} — ${decision.reason}${stored ? "" : " (not stored)"}`);
    notes.push(`${label(market)} ${decision.side ? `bets ${decision.side}` : "held"}`);
    if (decision.side) candidates.push({ market, decision });
  }

  const why = markets.length === 0 ? `no trading Windows on ${spec.cadences.map(formatCadence).join("/")}` : `read ${reads} of ${markets.length} agent Windows${notes.length ? `: ${notes.join("; ")}` : ""}`;
  return { candidates, scanned: markets.length, closestBps: null, why };
}
