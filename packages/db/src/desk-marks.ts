/**
 * Hourly PreStocks marks (S21): one row per (name, hour), the durable history grading reads a day later and the hub
 * sparkline reads. Written by the runner every hour for all eight names; `ON CONFLICT DO NOTHING` keeps the first.
 */
import type { Db } from "./client";
import { ensureSchema } from "./migrate";

export interface PriceMarkRow {
  symbol: string;
  atSec: number;
  tokenE8: string;
  markE8: string;
}

export function deskMarkQueries(db: Db) {
  const ready = () => ensureSchema();
  return {
    async upsertPriceMark(m: PriceMarkRow): Promise<void> {
      await ready();
      await db`INSERT INTO desk_price_marks (symbol, at_sec, token_e8, mark_e8) VALUES (${m.symbol}, ${m.atSec}, ${m.tokenE8}, ${m.markE8}) ON CONFLICT (symbol, at_sec) DO NOTHING`;
    },
    async listPriceMarks(i: { symbol: string; fromSec: number; toSec: number }): Promise<PriceMarkRow[]> {
      await ready();
      const rows = await db<{ symbol: string; at_sec: string; token_e8: string; mark_e8: string }[]>`
        SELECT symbol, at_sec, token_e8, mark_e8 FROM desk_price_marks WHERE symbol = ${i.symbol} AND at_sec >= ${i.fromSec} AND at_sec <= ${i.toSec} ORDER BY at_sec ASC`;
      return rows.map((r) => ({ symbol: r.symbol, atSec: Number(r.at_sec), tokenE8: r.token_e8, markE8: r.mark_e8 }));
    },
    /** The first mark at or after `atSec` (the alternative's price, a day after a decision); null when none yet. */
    async priceMarkAtOrAfter(i: { symbol: string; atSec: number }): Promise<PriceMarkRow | null> {
      await ready();
      const rows = await db<{ symbol: string; at_sec: string; token_e8: string; mark_e8: string }[]>`
        SELECT symbol, at_sec, token_e8, mark_e8 FROM desk_price_marks WHERE symbol = ${i.symbol} AND at_sec >= ${i.atSec} ORDER BY at_sec ASC LIMIT 1`;
      const r = rows[0];
      return r ? { symbol: r.symbol, atSec: Number(r.at_sec), tokenE8: r.token_e8, markE8: r.mark_e8 } : null;
    },
  };
}
