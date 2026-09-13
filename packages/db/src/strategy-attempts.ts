import { getDb } from "./client";
import { ensureSchema } from "./migrate";
import type { StrategyFillRecord } from "./strategies";

export type StrategyAttemptState = "attempting" | "filled" | "settled" | "nothing-filled" | "refused" | "reverted" | "unknown";
export interface StrategyAttempt {
  kind: "order" | "settle";
  strategyId: string;
  marketId: string;
  owner: string;
  runner: string;
  grantId: string;
  side: "up" | "down";
  stakeBase: string;
  fromBlock: string;
  nonce: number;
  state: StrategyAttemptState;
  txHash: string | null;
  reason: string | null;
}
export type NewStrategyAttempt = Omit<StrategyAttempt, "state" | "txHash" | "reason" | "kind"> & { kind?: "order" | "settle" };
type AttemptKey = Pick<StrategyAttempt, "strategyId" | "marketId" | "owner"> & { kind?: "order" | "settle" };
type Row = { kind: "order" | "settle"; strategy_id: string; market_id: string; owner: string; runner: string; grant_id: string; side: "up" | "down"; stake_base: string; from_block: string; nonce: number; state: StrategyAttemptState; tx_hash: string | null; reason: string | null };
const fromRow = (r: Row): StrategyAttempt => ({ kind: r.kind, strategyId: r.strategy_id, marketId: r.market_id, owner: r.owner, runner: r.runner, grantId: r.grant_id, side: r.side, stakeBase: r.stake_base, fromBlock: r.from_block, nonce: r.nonce, state: r.state, txHash: r.tx_hash, reason: r.reason });

async function requiredDb() {
  const db = getDb();
  if (!db) throw new Error("strategy execution store unavailable");
  await ensureSchema();
  return db;
}

export async function getStrategyAttempt(key: AttemptKey): Promise<StrategyAttempt | null> {
  const db = await requiredDb();
  const rows = await db<Row[]>`SELECT * FROM strategy_attempts WHERE strategy_id = ${key.strategyId} AND market_id = ${key.marketId.toLowerCase()} AND owner = ${key.owner.toLowerCase()} AND kind = ${key.kind ?? "order"}`;
  return rows[0] ? fromRow(rows[0]) : null;
}

/** A failed reservation prevents submission; an existing reservation is never resent. */
export async function beginStrategyAttempt(a: NewStrategyAttempt): Promise<boolean> {
  const db = await requiredDb();
  const rows = await db`INSERT INTO strategy_attempts (strategy_id, market_id, owner, runner, grant_id, side, stake_base, from_block, nonce, kind, state)
    VALUES (${a.strategyId}, ${a.marketId.toLowerCase()}, ${a.owner.toLowerCase()}, ${a.runner.toLowerCase()}, ${a.grantId}, ${a.side}, ${a.stakeBase}, ${a.fromBlock}, ${a.nonce}, ${a.kind ?? "order"}, 'attempting')
    ON CONFLICT (strategy_id, market_id, owner, kind) DO NOTHING RETURNING strategy_id`;
  return rows.length === 1;
}

export async function finishStrategyAttempt(key: AttemptKey, state: Exclude<StrategyAttemptState, "attempting" | "filled">, txHash: string | null, reason: string): Promise<void> {
  const db = await requiredDb();
  await db`UPDATE strategy_attempts SET state = ${state}, tx_hash = COALESCE(${txHash}, tx_hash), reason = ${reason}, updated_at = now()
    WHERE strategy_id = ${key.strategyId} AND market_id = ${key.marketId.toLowerCase()} AND owner = ${key.owner.toLowerCase()} AND kind = ${key.kind ?? "order"} AND state NOT IN ('filled', 'settled')`;
}

/** Fill attribution and successful attempt commit together, including during restart recovery. */
export async function recordAttemptFill(fill: StrategyFillRecord): Promise<void> {
  const db = await requiredDb();
  await db.begin(async (tx) => {
    await tx`INSERT INTO strategy_fills (tx_hash, strategy_id, grant_id, owner, market_id, side, cash_delta, token_delta, at_sec, dry_run)
      VALUES (${fill.txHash}, ${fill.strategyId}, ${fill.grantId}, ${fill.owner.toLowerCase()}, ${fill.marketId.toLowerCase()}, ${fill.side}, ${fill.cashDelta}, ${fill.tokenDelta}, ${fill.atSec}, false)
      ON CONFLICT (tx_hash) DO NOTHING`;
    await tx`UPDATE strategy_attempts SET state = 'filled', tx_hash = ${fill.txHash}, reason = NULL, updated_at = now()
      WHERE strategy_id = ${fill.strategyId} AND market_id = ${fill.marketId.toLowerCase()} AND owner = ${fill.owner.toLowerCase()} AND kind = 'order'`;
    await tx`UPDATE strategy_decisions SET filled = (SELECT COUNT(*) FROM strategy_attempts WHERE strategy_id = ${fill.strategyId} AND market_id = ${fill.marketId.toLowerCase()} AND kind = 'order' AND state = 'filled')
      WHERE strategy_id = ${fill.strategyId} AND market_id = ${fill.marketId.toLowerCase()} AND dry_run = false`;
  });
}

export async function listUnresolvedStrategyAttempts(runner: string): Promise<StrategyAttempt[]> {
  const db = await requiredDb();
  const rows = await db<Row[]>`SELECT * FROM strategy_attempts WHERE runner = ${runner.toLowerCase()} AND state IN ('attempting', 'unknown') ORDER BY from_block::numeric`;
  return rows.map(fromRow);
}

/** Includes paused/replaced subscriptions and attempts whose fill recording was interrupted. */
export async function listStrategyOwners(strategyId: string): Promise<string[]> {
  const db = await requiredDb();
  const rows = await db<{ owner: string }[]>`SELECT owner FROM strategy_fills WHERE strategy_id = ${strategyId} UNION SELECT owner FROM strategy_attempts WHERE strategy_id = ${strategyId}`;
  return rows.map((r) => r.owner);
}

export async function listAttemptedStrategyIds(runner: string): Promise<string[]> {
  const db = await requiredDb();
  const rows = await db<{ strategy_id: string }[]>`SELECT DISTINCT strategy_id FROM strategy_attempts WHERE runner = ${runner.toLowerCase()}`;
  return rows.map((r) => r.strategy_id);
}
