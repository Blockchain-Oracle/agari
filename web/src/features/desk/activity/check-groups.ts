import type { OutcomeColumn } from "@agari/core/desk";
import type { PreIpoSymbol } from "@agari/core/market";
import type { NodeTone } from "@/components/ui/desk-kit";
import type { RecordSummaryWire } from "../protocol";
import { namesIn } from "./activity-model";

/**
 * The record grouped for reading (S22 follow-up): one check writes one record per company it looked at, all within a
 * few seconds, so the timeline shows each check once, with a line per company, and folds runs of quiet checks. The
 * records themselves stay as they are: every line still opens its own decision.
 */
export const TONE: Record<OutcomeColumn, NodeTone> = {
  acted: "acted", acted_in_part: "acted", acted_by_override: "acted", would_have_acted: "acted",
  asked: "asked", declined: "declined", nothing_to_do: "quiet", waited: "quiet",
  not_executed: "error", blocked_by_limit: "stopped", failed: "error",
};

/** Which line leads a check: what needs the owner most, then what moved money, then what was turned down. */
const RANK: Record<NodeTone, number> = { asked: 0, error: 1, stopped: 2, acted: 3, declined: 4, quiet: 5, neutral: 6 };

/** Records within this many seconds of the newest in a group belong to the same check. */
export const SAME_CHECK_SEC = 90;

export interface CheckLine {
  record: RecordSummaryWire;
  tone: NodeTone;
  symbol: PreIpoSymbol | null;
  /** The summary's first sentence: the fact. The rest is the reason, shown when the check is opened. */
  lead: string;
  rest: string;
  /** The same company and verdict again within the check (a check that ran twice): counted, not repeated. */
  repeats: number;
}

export interface CheckGroup {
  atSec: number;
  tone: NodeTone;
  lines: CheckLine[];
  seqs: number[];
}

export type CheckRow = { kind: "check"; group: CheckGroup } | { kind: "quiet"; groups: CheckGroup[]; fromSec: number; toSec: number };

/** "OpenAI is 29.9% above its mark. Your ceiling is 10.0%." → lead "OpenAI is 29.9% above its mark.", rest the ceiling. */
export function splitSummary(summary: string): { lead: string; rest: string } {
  const text = summary.trim();
  const m = /^(.+?[.!?])\s+(?=[A-Z“"'(])(.+)$/s.exec(text);
  return m ? { lead: m[1]!, rest: m[2]!.trim() } : { lead: text, rest: "" };
}

/** Figures in a line (money, percentages, clock times), so the row can set them in the data face. */
export function figureParts(text: string): { text: string; figure: boolean }[] {
  const parts: { text: string; figure: boolean }[] = [];
  const re = /(\$[\d,]+(?:\.\d+)?|[-+−]?\d+(?:[.,]\d+)?%)/g;
  let at = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > at) parts.push({ text: text.slice(at, m.index), figure: false });
    parts.push({ text: m[0], figure: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), figure: false });
  return parts;
}

function line(record: RecordSummaryWire): CheckLine {
  return { record, tone: TONE[record.outcome], symbol: namesIn(record.summary)[0] ?? null, ...splitSummary(record.summary), repeats: 1 };
}

function group(records: RecordSummaryWire[]): CheckGroup {
  const lines: CheckLine[] = [];
  for (const record of records) {
    const next = line(record);
    const same = lines.find((l) => l.symbol === next.symbol && l.record.outcome === record.outcome);
    if (same) same.repeats += 1;
    else lines.push(next);
  }
  lines.sort((a, b) => RANK[a.tone] - RANK[b.tone]);
  return { atSec: records[0]!.decidedAtSec, tone: lines[0]!.tone, lines, seqs: records.map((r) => r.seq) };
}

/** Records arrive newest first; checks come out newest first. */
export function groupChecks(records: readonly RecordSummaryWire[]): CheckGroup[] {
  const groups: CheckGroup[] = [];
  let run: RecordSummaryWire[] = [];
  for (const record of records) {
    if (run.length > 0 && run[0]!.decidedAtSec - record.decidedAtSec > SAME_CHECK_SEC) {
      groups.push(group(run));
      run = [];
    }
    run.push(record);
  }
  if (run.length > 0) groups.push(group(run));
  return groups;
}

/** Two or more quiet checks in a row fold into one line that opens. */
export function checkRows(groups: readonly CheckGroup[]): CheckRow[] {
  const rows: CheckRow[] = [];
  let run: CheckGroup[] = [];
  const flush = () => {
    if (run.length >= 2) rows.push({ kind: "quiet", groups: run, fromSec: run[run.length - 1]!.atSec, toSec: run[0]!.atSec });
    else for (const g of run) rows.push({ kind: "check", group: g });
    run = [];
  };
  for (const g of groups) {
    if (g.tone === "quiet") run.push(g);
    else {
      flush();
      rows.push({ kind: "check", group: g });
    }
  }
  flush();
  return rows;
}
