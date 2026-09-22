import { OUTCOME_COLUMN, QUIET_OUTCOMES } from "@agari/core/desk";
import type { RecordSummaryWire } from "./protocol";

/**
 * The record list's rows (plan §5.7 item 7): entries as they are, and a run of two or more quiet checks (nothing to
 * do, waited) folded into one openable line, "6 quiet checks · 03:00–09:00". Records arrive newest first and stay so.
 */
export type RecordRow = { kind: "entry"; record: RecordSummaryWire } | { kind: "quiet"; records: RecordSummaryWire[]; fromSec: number; toSec: number };

/** The quiet outcomes as the record column spells them (core's `OUTCOME_COLUMN`). */
const QUIET = new Set<string>([...QUIET_OUTCOMES].map((o) => OUTCOME_COLUMN[o]));

export const isQuiet = (r: RecordSummaryWire): boolean => QUIET.has(r.outcome);

export function foldQuietRuns(records: readonly RecordSummaryWire[]): RecordRow[] {
  const rows: RecordRow[] = [];
  let run: RecordSummaryWire[] = [];
  const flush = () => {
    if (run.length >= 2) rows.push({ kind: "quiet", records: run, fromSec: run[run.length - 1]!.decidedAtSec, toSec: run[0]!.decidedAtSec });
    else for (const record of run) rows.push({ kind: "entry", record });
    run = [];
  };
  for (const record of records) {
    if (isQuiet(record)) run.push(record);
    else {
      flush();
      rows.push({ kind: "entry", record });
    }
  }
  flush();
  return rows;
}
