// recount --source events: the indexer's raw decoded events (`idx_events`) replayed afresh. Fast, but it trusts what
// ingestion stored; the projections (`idx_markets`, `idx_fills`, `idx_positions`) and the provider are never read.

import { getDb } from "@agari/db";
import { absorb, RECOUNT_EVENTS, type RawEvent, type SeriesGrid, type Tape } from "./facts";

interface EventRow {
  signature: string;
  slot: string;
  block_time_sec: string | null;
  outer_ix: number;
  inner_ix: number;
  name: string;
  market: string | null;
  seq: string | null;
  data: Record<string, unknown>;
}

export async function eventsTape(floorSec: number): Promise<Tape> {
  const sql = getDb();
  if (!sql) throw new Error("DATABASE_URL is not set (the indexer's database)");
  try {
    const rows = await sql<EventRow[]>`
      SELECT signature, slot::text, block_time_sec::text, outer_ix, inner_ix, name, market, seq::text, data
      FROM idx_events WHERE name = ANY(${[...RECOUNT_EVENTS]}::text[]) AND (block_time_sec IS NULL OR block_time_sec >= ${floorSec})
      ORDER BY slot, signature, outer_ix, inner_ix`;
    const tape: Tape = { windows: new Map(), fills: [], sets: [], grids: new Map(), notes: [], problems: [] };
    for (const row of rows) {
      const event: RawEvent = {
        signature: row.signature,
        slot: Number(row.slot),
        blockTimeSec: row.block_time_sec === null ? null : Number(row.block_time_sec),
        outerIx: row.outer_ix,
        innerIx: row.inner_ix,
        name: row.name,
        market: row.market,
        seq: row.seq,
        data: row.data,
      };
      absorb(tape, event);
    }
    const series = await sql<{ series: string; symbol: string | null; cadence_sec: number; lot_base: string; tick_base: string }[]>`
      SELECT series, symbol, cadence_sec, lot_base::text, tick_base::text FROM idx_series`;
    for (const s of series) tape.grids.set(s.series, { symbol: s.symbol, cadenceSec: s.cadence_sec, lotBase: BigInt(s.lot_base), tickBase: BigInt(s.tick_base) } satisfies SeriesGrid);
    tape.notes.push(`idx_events: ${rows.length} events since ${new Date(floorSec * 1000).toISOString()}, ${series.length} Series`);
    return tape;
  } finally {
    await sql.end();
  }
}
