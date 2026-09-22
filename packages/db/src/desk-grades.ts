/**
 * The desk marking its own homework (desk.md §8, plan §5.8): one grade per gradeable record, a day after it,
 * against the hourly PreStocks marks. Neutral both ways; a decision without an alternative is "ungradable", never
 * quietly a win.
 */
import type { Db } from "./client";
import { ensureSchema } from "./migrate";
import type { GradeRow } from "./desk-records";

/** Outcomes with an alternative worth comparing (core `grade.ts` COMPARISONS). */
const GRADEABLE = ["ACTED", "ACTED_IN_PART", "ACTED_BY_OVERRIDE", "WOULD_HAVE_ACTED", "WAITED", "DECLINED"];

export interface UngradedRecord {
  seq: number;
  outcome: string;
  symbol: string | null;
  side: "buy" | "sell" | null;
  decidedAtSec: number;
  body: Record<string, unknown>;
}

export function deskGradeQueries(db: Db) {
  const ready = () => ensureSchema();
  return {
    /** Gradeable records decided at or before `beforeSec` with no grade yet, oldest first. */
    async ungradedRecords(i: { deskId: string; beforeSec: number; limit?: number }): Promise<UngradedRecord[]> {
      await ready();
      const rows = await db<{ seq: string; outcome: string; symbol: string | null; side: "buy" | "sell" | null; decided_at_sec: string; body: Record<string, unknown> }[]>`
        SELECT r.seq, r.outcome, r.symbol, r.side, r.decided_at_sec, r.body FROM desk_records r
        LEFT JOIN desk_grades g ON g.desk_id = r.desk_id AND g.record_seq = r.seq
        WHERE r.desk_id = ${i.deskId}::uuid AND g.record_seq IS NULL AND r.decided_at_sec <= ${i.beforeSec} AND r.outcome IN ${db(GRADEABLE)}
        ORDER BY r.seq ASC LIMIT ${i.limit ?? 20}`;
      return rows.map((r) => ({ seq: Number(r.seq), outcome: r.outcome, symbol: r.symbol, side: r.side, decidedAtSec: Number(r.decided_at_sec), body: r.body }));
    },
    async saveGrade(i: { deskId: string } & Omit<GradeRow, "seq">): Promise<void> {
      await ready();
      await db`INSERT INTO desk_grades (desk_id, record_seq, graded_at_sec, verdict, difference_bps, price_then_e8, price_later_e8, chosen, alternative, why, counts_for_timing)
        VALUES (${i.deskId}::uuid, ${i.recordSeq}, ${i.gradedAtSec}, ${i.verdict}, ${i.differenceBps}, ${i.priceThenE8}, ${i.priceLaterE8}, ${i.chosen}, ${i.alternative}, ${i.why}, ${i.countsForTiming})
        ON CONFLICT (desk_id, record_seq) DO NOTHING`;
    },
    async listGrades(i: { deskId: string; limit: number }): Promise<GradeRow[]> {
      await ready();
      const rows = await db<{ record_seq: string; graded_at_sec: string; verdict: GradeRow["verdict"]; difference_bps: number | null; price_then_e8: string | null; price_later_e8: string | null; chosen: string; alternative: string; why: string; counts_for_timing: boolean }[]>`
        SELECT * FROM desk_grades WHERE desk_id = ${i.deskId}::uuid ORDER BY record_seq DESC LIMIT ${i.limit}`;
      return rows.map((g) => ({ recordSeq: Number(g.record_seq), seq: Number(g.record_seq), gradedAtSec: Number(g.graded_at_sec), verdict: g.verdict, differenceBps: g.difference_bps, priceThenE8: g.price_then_e8, priceLaterE8: g.price_later_e8, chosen: g.chosen, alternative: g.alternative, why: g.why, countsForTiming: g.counts_for_timing }));
    },
  };
}
