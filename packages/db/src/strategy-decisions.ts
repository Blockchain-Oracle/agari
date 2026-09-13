import { getDb } from "./client";
import { ensureSchema } from "./migrate";

export type DecisionVerdictSide = "up" | "down" | "hold" | "none";
export type DecisionGate = "trade" | "held" | "failed";

/** One Window an agent strategy read: the model's words, the gate's ruling, what the runner then sent. */
export interface StrategyDecisionRecord {
  id: number;
  strategyId: string;
  marketId: string;
  runner: string;
  decidedAtMs: number;
  model: string;
  promptHash: string;
  verdictSide: DecisionVerdictSide;
  confidence: number | null;
  why: string;
  gate: DecisionGate;
  gateReason: string;
  side: "up" | "down" | null;
  filled: number;
  skipped: number;
  dryRun: boolean;
}

export type NewStrategyDecision = Omit<StrategyDecisionRecord, "id" | "decidedAtMs" | "filled" | "skipped">;

/** Reserve before the provider call. The database, not the process cache, owns uniqueness. */
export async function beginStrategyDecision(d: Pick<NewStrategyDecision, "strategyId" | "marketId" | "runner" | "model" | "promptHash" | "dryRun">): Promise<"acquired" | "existing"> {
  const db = getDb();
  if (!db) throw new Error("decision store unavailable");
  await ensureSchema();
  const rows = await db`
    INSERT INTO strategy_decisions (strategy_id, market_id, runner, model, prompt_hash, verdict_side, why, gate, gate_reason, dry_run)
    VALUES (${d.strategyId}, ${d.marketId.toLowerCase()}, ${d.runner.toLowerCase()}, ${d.model}, ${d.promptHash}, 'none', 'Reading this Window', 'pending', 'Read in progress', ${d.dryRun})
    ON CONFLICT (strategy_id, market_id, dry_run) DO NOTHING RETURNING id
  `;
  return rows.length ? "acquired" : "existing";
}

/** A process that died during a provider call holds that Window; it never asks twice. */
export async function interruptStrategyDecisions(runner: string, beforeMs: number): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("decision store unavailable");
  await ensureSchema();
  await db`UPDATE strategy_decisions SET gate = 'failed', why = 'Runner interrupted during the model read', gate_reason = 'Interrupted read; holding this Window without another model call'
    WHERE runner = ${runner.toLowerCase()} AND gate = 'pending' AND decided_at < ${new Date(beforeMs)}`;
}

interface DecisionRow {
  id: string;
  strategy_id: string;
  market_id: string;
  runner: string;
  decided_at: Date;
  model: string;
  prompt_hash: string;
  verdict_side: DecisionVerdictSide;
  confidence: number | null;
  why: string;
  gate: DecisionGate;
  gate_reason: string;
  side: "up" | "down" | null;
  filled: number;
  skipped: number;
  dry_run: boolean;
}

const toDecision = (r: DecisionRow): StrategyDecisionRecord => ({
  id: Number(r.id),
  strategyId: r.strategy_id,
  marketId: r.market_id,
  runner: r.runner,
  decidedAtMs: r.decided_at.getTime(),
  model: r.model,
  promptHash: r.prompt_hash,
  verdictSide: r.verdict_side,
  confidence: r.confidence,
  why: r.why,
  gate: r.gate,
  gateReason: r.gate_reason,
  side: r.side,
  filled: r.filled,
  skipped: r.skipped,
  dryRun: r.dry_run,
});

/**
 * One read per Window: the (strategy, market) pair is unique, so a runner that restarts mid-Window
 * cannot ask twice. Ids are lowercased at the write — the reads lowercase too, and a table whose
 * writes do not is one the settler was blind to for its whole life.
 */
export async function recordStrategyDecision(d: NewStrategyDecision): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  await ensureSchema();
  const rows = await db`
    UPDATE strategy_decisions SET model = ${d.model}, prompt_hash = ${d.promptHash}, verdict_side = ${d.verdictSide}, confidence = ${d.confidence}, why = ${d.why}, gate = ${d.gate}, gate_reason = ${d.gateReason}, side = ${d.side}
    WHERE strategy_id = ${d.strategyId} AND market_id = ${d.marketId.toLowerCase()} AND dry_run = ${d.dryRun} AND gate = 'pending' RETURNING id
  `;
  return rows.length === 1;
}

/** After the execution loop: how many subscribers the decision reached, and how many it skipped. */
export async function markDecisionExecution(strategyId: string, marketId: string, filled: number, skipped: number, dryRun = false): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  await ensureSchema();
  await db`UPDATE strategy_decisions SET filled = GREATEST(filled, ${filled}), skipped = ${skipped} WHERE strategy_id = ${strategyId} AND market_id = ${marketId.toLowerCase()} AND dry_run = ${dryRun}`;
  return true;
}

/**
 * Newest first; all strategies when `strategyId` is null. Dry-run rows are left out unless asked for:
 * the card never shows a rehearsal as memory, but the runner warms its "already read" set from every row.
 */
export async function listStrategyDecisions(strategyId: string | null, limit: number | null, includeDryRun = false): Promise<StrategyDecisionRecord[] | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const dry = includeDryRun ? db`` : db`AND dry_run = false`;
  const rows = strategyId
    ? await db<DecisionRow[]>`SELECT * FROM strategy_decisions WHERE strategy_id = ${strategyId} AND gate <> 'pending' ${dry} ORDER BY decided_at DESC LIMIT ${limit}`
    : await db<DecisionRow[]>`SELECT * FROM strategy_decisions WHERE gate <> 'pending' ${dry} ORDER BY decided_at DESC LIMIT ${limit}`;
  return rows.map(toDecision);
}

export async function getStrategyDecision(strategyId: string, marketId: string, dryRun: boolean): Promise<StrategyDecisionRecord | null> {
  const db = getDb();
  if (!db) throw new Error("decision store unavailable");
  await ensureSchema();
  const rows = await db<DecisionRow[]>`SELECT * FROM strategy_decisions WHERE strategy_id = ${strategyId} AND market_id = ${marketId.toLowerCase()} AND dry_run = ${dryRun} AND gate <> 'pending'`;
  return rows[0] ? toDecision(rows[0]) : null;
}
