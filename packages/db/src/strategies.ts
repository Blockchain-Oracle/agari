import { getDb } from "./client";
import { ensureSchema } from "./migrate";

export interface HeartbeatRecord {
  runner: string;
  strategyId: string;
  tickAtMs: number;
  intervalMs: number;
  why: string;
  scanned: number;
  closestBps: number | null;
  dryRun: boolean;
}

export type NewHeartbeat = Omit<HeartbeatRecord, "tickAtMs">;

export interface StrategyFillRecord {
  txHash: string;
  strategyId: string;
  grantId: string;
  owner: string;
  marketId: string;
  side: "up" | "down";
  cashDelta: string;
  tokenDelta: string;
  atSec: number;
  dryRun: boolean;
}

interface HeartbeatRow {
  runner: string;
  strategy_id: string;
  tick_at: Date;
  interval_ms: number;
  why: string;
  scanned: number;
  closest_bps: number | null;
  dry_run: boolean;
}

interface FillRow {
  tx_hash: string;
  strategy_id: string;
  grant_id: string;
  owner: string;
  market_id: string;
  side: "up" | "down";
  cash_delta: string;
  token_delta: string;
  at_sec: string;
  dry_run: boolean;
}

const toHeartbeat = (r: HeartbeatRow): HeartbeatRecord => ({
  runner: r.runner,
  strategyId: r.strategy_id,
  tickAtMs: r.tick_at.getTime(),
  intervalMs: r.interval_ms,
  why: r.why,
  scanned: r.scanned,
  closestBps: r.closest_bps,
  dryRun: r.dry_run,
});

const toFill = (r: FillRow): StrategyFillRecord => ({
  txHash: r.tx_hash,
  strategyId: r.strategy_id,
  grantId: r.grant_id,
  owner: r.owner,
  marketId: r.market_id,
  side: r.side,
  cashDelta: r.cash_delta,
  tokenDelta: r.token_delta,
  atSec: Number(r.at_sec),
  dryRun: r.dry_run,
});

/** The runner's cycle, durably. Returns false when no database is configured — the runner logs on regardless. */
export async function recordHeartbeat(beat: NewHeartbeat): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  await ensureSchema();
  await db`
    INSERT INTO runner_heartbeats (runner, strategy_id, interval_ms, why, scanned, closest_bps, dry_run)
    VALUES (${beat.runner.toLowerCase()}, ${beat.strategyId}, ${beat.intervalMs}, ${beat.why}, ${beat.scanned}, ${beat.closestBps}, ${beat.dryRun})
  `;
  return true;
}

/** The latest heartbeat per strategy; `null` when no store is configured — never an empty "all dead". */
export async function latestHeartbeats(): Promise<HeartbeatRecord[] | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows = await db<HeartbeatRow[]>`
    SELECT DISTINCT ON (strategy_id) runner, strategy_id, tick_at, interval_ms, why, scanned, closest_bps, dry_run
    FROM runner_heartbeats
    ORDER BY strategy_id, tick_at DESC
  `;
  return rows.map(toHeartbeat);
}

/** The runner's last words for one strategy, newest first — the live why/why-not feed. */
export async function recentHeartbeats(strategyId: string, limit: number): Promise<HeartbeatRecord[] | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows = await db<HeartbeatRow[]>`
    SELECT runner, strategy_id, tick_at, interval_ms, why, scanned, closest_bps, dry_run
    FROM runner_heartbeats WHERE strategy_id = ${strategyId}
    ORDER BY tick_at DESC LIMIT ${limit}
  `;
  return rows.map(toHeartbeat);
}

/** A fill's receipt; the tx hash keys it, so a cycle that re-reads its own receipt cannot double-count. */
export async function recordStrategyFill(fill: StrategyFillRecord): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  await ensureSchema();
  await db`
    INSERT INTO strategy_fills (tx_hash, strategy_id, grant_id, owner, market_id, side, cash_delta, token_delta, at_sec, dry_run)
    VALUES (${fill.txHash}, ${fill.strategyId}, ${fill.grantId}, ${fill.owner.toLowerCase()}, ${fill.marketId}, ${fill.side}, ${fill.cashDelta}, ${fill.tokenDelta}, ${fill.atSec}, ${fill.dryRun})
    ON CONFLICT (tx_hash) DO NOTHING
  `;
  return true;
}

/** Newest first; all strategies when `strategyId` is null. Dry-run rows are excluded: they are not trades. */
export async function listStrategyFills(strategyId: string | null, limit: number | null): Promise<StrategyFillRecord[] | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows = strategyId
    ? await db<FillRow[]>`SELECT * FROM strategy_fills WHERE strategy_id = ${strategyId} AND dry_run = false ORDER BY at_sec DESC LIMIT ${limit}`
    : await db<FillRow[]>`SELECT * FROM strategy_fills WHERE dry_run = false ORDER BY at_sec DESC LIMIT ${limit}`;
  return rows.map(toFill);
}

/** The creator's plain-text playbook. The caller verifies the creator's signature; this layer does not gate. */
export async function upsertPlaybook(strategyId: string, creator: string, body: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  await ensureSchema();
  await db`
    INSERT INTO strategy_playbooks (strategy_id, creator, body) VALUES (${strategyId}, ${creator.toLowerCase()}, ${body})
    ON CONFLICT (strategy_id) DO UPDATE SET creator = EXCLUDED.creator, body = EXCLUDED.body, updated_at = now()
  `;
  return true;
}

export async function listPlaybooks(): Promise<Array<{ strategyId: string; creator: string; body: string; updatedAtMs: number }> | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows = await db<Array<{ strategy_id: string; creator: string; body: string; updated_at: Date }>>`SELECT strategy_id, creator, body, updated_at FROM strategy_playbooks`;
  return rows.map((r) => ({ strategyId: r.strategy_id, creator: r.creator, body: r.body, updatedAtMs: r.updated_at.getTime() }));
}
