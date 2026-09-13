import { getDb } from "./client";
import { ensureSchema } from "./migrate";

/**
 * Lucky's rows: one per spin, from the commitment a browser saw before it chose a seed to the verdict the
 * chain gave the Window it was placed on.
 *
 * What this table is and is not. It is the record of a draw — seeds, nonce, policy, the candidate hash and
 * the quote that was dealt — which nothing on chain carries, so it has to live here to be checkable. It is
 * NOT the record of the money: the fill is the venue's, the settlement is the venue's, and the columns that
 * describe them (`tx_hash`, `cost_base`, `quantity_raw`, the result from `pending` on) are written only from
 * a read of the tape or the chain, by the server, never from a browser's claim.
 *
 * Every address is lowercased at the write (`key`), for the reason `games.ts` records: a table whose reads
 * lowercase and whose writes do not answers every query with zero rows.
 */

export type LuckyRowResult = "drawn" | "placed" | "pending" | "won" | "lost" | "void" | "cashed-out" | "refused" | "unknown";

function key(value: string): string {
  return value.toLowerCase();
}

export interface LuckyDrawRow {
  drawId: string;
  wallet: string;
  nonce: number;
  policyVersion: number;
  stakeBase: string;
  commitment: string;
  serverSeed: string;
  clientSeed: string | null;
  asset: string | null;
  side: "up" | "down" | null;
  multiplier: number | null;
  candidateHash: string | null;
  marketId: string | null;
  quoteAvgPriceBps: number | null;
  quoteContractsRaw: string | null;
  txHash: string | null;
  costBase: string | null;
  quantityRaw: string | null;
  result: LuckyRowResult;
  refusal: string | null;
  createdAtMs: number;
  revealedAtMs: number | null;
  placedAtMs: number | null;
  settledAtMs: number | null;
}

type Raw = Record<string, string | number | Date | null>;


const text = (v: string | number | Date | null | undefined): string | null => (v === null || v === undefined ? null : String(v));
const int = (v: string | number | Date | null | undefined): number | null => (v === null || v === undefined ? null : Number(v));
const when = (v: string | number | Date | null | undefined): number | null => (v instanceof Date ? v.getTime() : null);

function toRow(r: Raw): LuckyDrawRow {
  return {
    drawId: String(r.draw_id),
    wallet: String(r.wallet),
    nonce: Number(r.nonce),
    policyVersion: Number(r.policy_version),
    stakeBase: String(r.stake_base),
    commitment: String(r.commitment),
    serverSeed: String(r.server_seed),
    clientSeed: text(r.client_seed),
    asset: text(r.asset),
    side: r.side === "up" || r.side === "down" ? r.side : null,
    multiplier: int(r.multiplier),
    candidateHash: text(r.candidate_hash),
    marketId: text(r.market_id),
    quoteAvgPriceBps: int(r.quote_avg_price_bps),
    quoteContractsRaw: text(r.quote_contracts_raw),
    txHash: text(r.tx_hash),
    costBase: text(r.cost_base),
    quantityRaw: text(r.quantity_raw),
    result: String(r.result) as LuckyRowResult,
    refusal: text(r.refusal),
    createdAtMs: when(r.created_at) ?? 0,
    revealedAtMs: when(r.revealed_at),
    placedAtMs: when(r.placed_at),
    settledAtMs: when(r.settled_at),
  };
}

export interface NewLuckyDraw {
  drawId: string;
  wallet: string;
  policyVersion: number;
  stakeBase: string;
  commitment: string;
  serverSeed: string;
}

/**
 * The commitment row. The nonce is the wallet's next, taken inside the insert so two spins that race take
 * two different numbers; the unique constraint catches the one interleaving the subquery cannot, and the
 * caller retries once. Fails loudly: a commitment nobody can look up is a spin that never happened.
 */
export async function createLuckyDraw(draw: NewLuckyDraw): Promise<{ drawId: string; nonce: number }> {
  const db = getDb();
  if (!db) throw new Error("no DATABASE_URL: a draw cannot be committed without somewhere to keep its seed");
  await ensureSchema();
  const wallet = key(draw.wallet);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const rows = await db<{ nonce: number }[]>`
        INSERT INTO lucky_draws (draw_id, wallet, nonce, policy_version, stake_base, commitment, server_seed, result)
        SELECT ${key(draw.drawId)}, ${wallet}, COALESCE(MAX(nonce), 0) + 1, ${draw.policyVersion}, ${draw.stakeBase},
               ${key(draw.commitment)}, ${key(draw.serverSeed)}, 'drawn'
        FROM lucky_draws WHERE wallet = ${wallet}
        RETURNING nonce
      `;
      const row = rows[0];
      if (row) return { drawId: key(draw.drawId), nonce: row.nonce };
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "23505" || attempt === 1) throw error;
    }
  }
  throw new Error("the draw could not take a nonce");
}

export async function getLuckyDraw(drawId: string): Promise<LuckyDrawRow | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows = await db<Raw[]>`SELECT * FROM lucky_draws WHERE draw_id = ${key(drawId)}`;
  const row = rows[0];
  return row ? toRow(row) : null;
}

export interface LuckyReveal {
  clientSeed: string;
  asset: string;
  side: "up" | "down";
  multiplier: number;
  candidateHash: string;
  /** Null when no Window qualified: the draw was still fair, the venue was thin. */
  marketId: string | null;
  quoteAvgPriceBps: number | null;
  quoteContractsRaw: string | null;
  result: "drawn" | "refused";
  refusal: string | null;
}

/** The deal, written once: a second reveal for the same draw changes nothing, so a retried request is harmless. */
export async function revealLuckyDraw(drawId: string, reveal: LuckyReveal): Promise<void> {
  const db = getDb();
  if (!db) return;
  await ensureSchema();
  await db`
    UPDATE lucky_draws SET
      client_seed = ${key(reveal.clientSeed)}, asset = ${reveal.asset}, side = ${reveal.side}, multiplier = ${reveal.multiplier},
      candidate_hash = ${key(reveal.candidateHash)}, market_id = ${reveal.marketId === null ? null : key(reveal.marketId)},
      quote_avg_price_bps = ${reveal.quoteAvgPriceBps}, quote_contracts_raw = ${reveal.quoteContractsRaw},
      result = ${reveal.result}, refusal = ${reveal.refusal}, revealed_at = now()
    WHERE draw_id = ${key(drawId)} AND client_seed IS NULL
  `;
}

export interface LuckyPlacement {
  result: "placed" | "pending" | "refused" | "unknown";
  txHash: string | null;
  costBase: string | null;
  quantityRaw: string | null;
  refusal: string | null;
}

/** What the signature came back as. `COALESCE` keeps a hash a later, thinner report would otherwise blank. */
export async function recordLuckyPlacement(drawId: string, placement: LuckyPlacement): Promise<void> {
  const db = getDb();
  if (!db) return;
  await ensureSchema();
  await db`
    UPDATE lucky_draws SET
      result = ${placement.result},
      tx_hash = COALESCE(${placement.txHash === null ? null : key(placement.txHash)}, tx_hash),
      cost_base = COALESCE(${placement.costBase}, cost_base),
      quantity_raw = COALESCE(${placement.quantityRaw}, quantity_raw),
      refusal = ${placement.refusal},
      placed_at = COALESCE(placed_at, now())
    WHERE draw_id = ${key(drawId)}
  `;
}

/** The chain's verdict, or the book's — the last thing a row is ever told. */
export async function recordLuckyResult(drawId: string, result: "won" | "lost" | "void" | "cashed-out" | "refused", refusal: string | null = null): Promise<void> {
  const db = getDb();
  if (!db) return;
  await ensureSchema();
  await db`
    UPDATE lucky_draws SET result = ${result}, refusal = ${refusal}, settled_at = COALESCE(settled_at, now())
    WHERE draw_id = ${key(drawId)}
  `;
}

/** A wallet's spins, newest first — the history page's one query. */
export async function listLuckyDrawsFor(wallet: string, limit = 50): Promise<LuckyDrawRow[]> {
  const db = getDb();
  if (!db) return [];
  await ensureSchema();
  const rows = await db<Raw[]>`
    SELECT * FROM lucky_draws WHERE wallet = ${key(wallet)} ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows.map(toRow);
}

const OPEN: readonly LuckyRowResult[] = ["placed", "pending", "unknown"];

/** The rows still owed a verdict — what a history read reconciles against the chain before it answers. */
export async function listLuckyOpenFor(wallet: string, limit = 20): Promise<LuckyDrawRow[]> {
  const db = getDb();
  if (!db) return [];
  await ensureSchema();
  const rows = await db<Raw[]>`
    SELECT * FROM lucky_draws
    WHERE wallet = ${key(wallet)} AND result = ANY(${OPEN as unknown as string[]})
    ORDER BY created_at ASC LIMIT ${limit}
  `;
  return rows.map(toRow);
}

export interface LuckyVerifiedRow {
  wallet: string;
  result: "won" | "lost" | "void";
  createdAtMs: number;
}

/**
 * Every settled spin, newest first, capped — the board's whole input. The streaks themselves are computed
 * by core's rule in the caller, so the ladder and a player's own number can never disagree on what counts.
 */
export async function listLuckyVerified(limit = 2_000): Promise<LuckyVerifiedRow[]> {
  const db = getDb();
  if (!db) return [];
  await ensureSchema();
  const rows = await db<{ wallet: string; result: string; created_at: Date }[]>`
    SELECT wallet, result, created_at FROM lucky_draws
    WHERE result IN ('won', 'lost', 'void')
    ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows.map((r) => ({ wallet: r.wallet, result: r.result as LuckyVerifiedRow["result"], createdAtMs: r.created_at.getTime() }));
}
