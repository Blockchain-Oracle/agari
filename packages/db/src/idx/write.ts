/**
 * The indexer's writer (plan §4 indexer steps 5–9): idempotent inserts keyed `(signature, outer_ix, inner_ix)`,
 * projections and the cursor in one DB transaction, `(market, seq)` gap reads, finality promotion, dropped-transaction
 * removal and Market rebuilds.
 */
import type postgres from "postgres";
import { INDEX_TABLES } from "../schema-index";
import { applyEvent } from "./apply";
import type { IdxCommitment, IdxCursor, IdxEvent, IdxSeries, IdxTransaction } from "./types";

type Sql = postgres.Sql;
type Tx = postgres.TransactionSql;
type EventRow = { signature: string; outer_ix: number; inner_ix: number; slot: string; block_time_sec: string | null; name: string; market: string | null; seq: string | null; data: Record<string, unknown> };

const PROJECTIONS = ["idx_candles", "idx_positions", "idx_fills", "idx_orders", "idx_prints", "idx_markets"] as const;

const eventOf = (r: EventRow): IdxEvent => ({
  signature: r.signature,
  slot: Number(r.slot),
  blockTimeSec: r.block_time_sec === null ? null : Number(r.block_time_sec),
  outerIx: r.outer_ix,
  innerIx: r.inner_ix,
  name: r.name,
  market: r.market,
  seq: r.seq,
  data: r.data,
});

const bySeq = (a: IdxEvent, b: IdxEvent) => Number(BigInt(a.seq ?? "0") - BigInt(b.seq ?? "0")) || a.outerIx - b.outerIx || a.innerIx - b.innerIx;

/** Deletes one Market's projections and replays its stored events in `seq` order. */
async function rebuildMarketTx(tx: Tx, market: string): Promise<void> {
  for (const table of PROJECTIONS) await tx`DELETE FROM ${tx(table)} WHERE market = ${market}`;
  const rows = await tx<EventRow[]>`SELECT * FROM idx_events WHERE market = ${market} ORDER BY seq, signature, outer_ix, inner_ix`;
  for (const row of rows) await applyEvent(tx, eventOf(row));
}

async function advanceCursor(tx: Tx, cursor: IdxCursor): Promise<void> {
  await tx`
    INSERT INTO idx_cursor (program, slot, signature, updated_at_ms) VALUES (${cursor.program}, ${cursor.slot}, ${cursor.signature}, ${Date.now()})
    ON CONFLICT (program) DO UPDATE SET slot = EXCLUDED.slot, signature = EXCLUDED.signature, updated_at_ms = EXCLUDED.updated_at_ms
    WHERE idx_cursor.slot <= EXCLUDED.slot`;
}

export type WriteResult = { inserted: boolean; markets: string[]; rebuilt: string[] };

export function indexWriter(sql: Sql) {
  return {
    async cursor(program: string): Promise<IdxCursor | null> {
      const [row] = await sql<{ slot: string; signature: string }[]>`SELECT slot, signature FROM idx_cursor WHERE program = ${program}`;
      return row ? { program, slot: Number(row.slot), signature: row.signature } : null;
    },

    /** Commitment of each already-indexed signature. */
    async known(signatures: readonly string[]): Promise<Map<string, IdxCommitment>> {
      if (signatures.length === 0) return new Map();
      const rows = await sql<{ signature: string; commitment: IdxCommitment }[]>`SELECT signature, commitment FROM idx_txs WHERE signature = ANY(${signatures as string[]}::text[])`;
      return new Map(rows.map((r) => [r.signature, r.commitment]));
    },

    async knownSeries(series: readonly string[]): Promise<Set<string>> {
      if (series.length === 0) return new Set();
      const rows = await sql<{ series: string }[]>`SELECT series FROM idx_series WHERE series = ANY(${series as string[]}::text[])`;
      return new Set(rows.map((r) => r.series));
    },

    async upsertSeries(rows: readonly IdxSeries[]): Promise<void> {
      for (const s of rows) {
        await sql`
          INSERT INTO idx_series (series, ticker, symbol, cadence_sec, basis, lot_base, tick_base, cash_unit)
          VALUES (${s.series}, ${s.ticker}, ${s.symbol}, ${s.cadenceSec}, ${s.basis}, ${s.lotBase}::numeric, ${s.tickBase}::numeric, ${s.cashUnit}::numeric)
          ON CONFLICT (series) DO NOTHING`;
      }
    },

    /**
     * One transaction with its events and projections, atomically, plus the cursor when given. A transaction already
     * indexed is not re-applied (its commitment and the cursor still advance). An event older than one already applied
     * to its Market makes that Market rebuild from stored events inside the same DB transaction.
     */
    async writeTransaction(t: IdxTransaction, options: { commitment: IdxCommitment; cursor?: IdxCursor }): Promise<WriteResult> {
      return sql.begin(async (tx) => {
        const inserted = await tx`
          INSERT INTO idx_txs (signature, slot, block_time_sec, failed, events, commitment, indexed_at_ms)
          VALUES (${t.signature}, ${t.slot}, ${t.blockTimeSec}, ${t.failed}, ${t.events.length}, ${options.commitment}, ${Date.now()})
          ON CONFLICT (signature) DO NOTHING RETURNING signature`;
        if (inserted.length === 0) {
          if (options.commitment === "finalized") await tx`UPDATE idx_txs SET commitment = 'finalized' WHERE signature = ${t.signature}`;
          if (options.cursor) await advanceCursor(tx, options.cursor);
          return { inserted: false, markets: [], rebuilt: [] };
        }
        const markets = [...new Set(t.events.map((e) => e.market).filter((m): m is string => m !== null))];
        const lastSeq = new Map<string, bigint>();
        if (markets.length > 0) {
          // Serializes writers per Market (live and backfill can race on the same Window's first events).
          for (const market of [...markets].sort()) await tx`SELECT pg_advisory_xact_lock(hashtext(${market}))`;
          const rows = await tx<{ market: string; last_seq: string }[]>`SELECT market, last_seq FROM idx_markets WHERE market = ANY(${markets}::text[])`;
          for (const r of rows) lastSeq.set(r.market, BigInt(r.last_seq));
        }
        const rebuild = new Set<string>();
        for (const e of [...t.events].sort(bySeq)) {
          await tx`
            INSERT INTO idx_events (signature, outer_ix, inner_ix, slot, block_time_sec, name, market, seq, data)
            VALUES (${e.signature}, ${e.outerIx}, ${e.innerIx}, ${e.slot}, ${e.blockTimeSec}, ${e.name}, ${e.market}, ${e.seq}::bigint, ${tx.json(e.data as postgres.JSONValue)})
            ON CONFLICT DO NOTHING`;
          if (!e.market || e.seq === null) continue;
          const seq = BigInt(e.seq);
          if (rebuild.has(e.market) || seq <= (lastSeq.get(e.market) ?? 0n)) {
            rebuild.add(e.market);
            continue;
          }
          await applyEvent(tx, e);
          lastSeq.set(e.market, seq);
        }
        for (const market of rebuild) await rebuildMarketTx(tx, market);
        if (options.cursor) await advanceCursor(tx, options.cursor);
        return { inserted: true, markets, rebuilt: [...rebuild] };
      });
    },

    /** Marks already-indexed transactions finalized and advances the cursor, in one DB transaction. */
    async promote(signatures: readonly string[], cursor: IdxCursor | null): Promise<void> {
      await sql.begin(async (tx) => {
        if (signatures.length > 0) await tx`UPDATE idx_txs SET commitment = 'finalized' WHERE signature = ANY(${signatures as string[]}::text[]) AND commitment = 'confirmed'`;
        if (cursor) await advanceCursor(tx, cursor);
      });
    },

    /** Confirmed (not yet finalized) transactions in `(afterSlot, throughSlot]`. */
    async confirmedBetween(afterSlot: number, throughSlot: number): Promise<Array<{ signature: string; slot: number }>> {
      const rows = await sql<{ signature: string; slot: string }[]>`
        SELECT signature, slot FROM idx_txs WHERE commitment = 'confirmed' AND slot > ${afterSlot} AND slot <= ${throughSlot}`;
      return rows.map((r) => ({ signature: r.signature, slot: Number(r.slot) }));
    },

    /** Removes transactions the cluster dropped and rebuilds every Market they touched. Returns those Markets. */
    async dropTransactions(signatures: readonly string[]): Promise<string[]> {
      if (signatures.length === 0) return [];
      return sql.begin(async (tx) => {
        const rows = await tx<{ market: string }[]>`SELECT DISTINCT market FROM idx_events WHERE signature = ANY(${signatures as string[]}::text[]) AND market IS NOT NULL`;
        await tx`DELETE FROM idx_txs WHERE signature = ANY(${signatures as string[]}::text[])`;
        for (const r of rows) await rebuildMarketTx(tx, r.market);
        return rows.map((r) => r.market);
      });
    },

    async rebuildMarkets(markets: readonly string[]): Promise<void> {
      await sql.begin(async (tx) => {
        for (const market of markets) await rebuildMarketTx(tx, market);
      });
    },

    /** Markets whose stored `seq` values have holes: fewer distinct seqs than the highest seq. */
    async gaps(markets: readonly string[]): Promise<Array<{ market: string; have: number; maxSeq: number }>> {
      if (markets.length === 0) return [];
      const rows = await sql<{ market: string; have: number; max_seq: string }[]>`
        SELECT market, count(DISTINCT seq)::int AS have, max(seq)::text AS max_seq FROM idx_events
        WHERE market = ANY(${markets as string[]}::text[]) GROUP BY market HAVING count(DISTINCT seq) < max(seq)`;
      return rows.map((r) => ({ market: r.market, have: r.have, maxSeq: Number(r.max_seq) }));
    },

    /** Full rebuild (plan §4 indexer step 9): every idx_ table, cursor included. */
    async truncate(): Promise<void> {
      await sql.unsafe(`TRUNCATE ${INDEX_TABLES.join(", ")}`);
    },
  };
}

export type IndexWriter = ReturnType<typeof indexWriter>;
