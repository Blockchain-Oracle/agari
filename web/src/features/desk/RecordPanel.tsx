"use client";

import Link from "next/link";
import { DESK } from "./copy";
import { Panel } from "./DeskPanels";
import { ago, clock } from "./format";
import { Outcome } from "./Outcome";
import type { RecordSummaryWire } from "./protocol";
import { foldQuietRuns, type RecordRow } from "./record-rows";

/** One record as a line that opens the decision; shared with the whole-record page. */
export function Entry({ record, base, nowSec, quietLine }: { record: RecordSummaryWire; base: string; nowSec: number; quietLine?: boolean }) {
  const href = `${base}/decision/${record.seq}`;
  if (quietLine) {
    return (
      <Link href={href} className="flex items-baseline justify-between gap-3 type-caption text-ink-secondary hover:text-ink">
        <span>{record.summary}</span>
        <span className="shrink-0 text-ink-muted">#{record.seq}</span>
      </Link>
    );
  }
  return (
    <Link href={href} className="dk-entry" data-cursor="hover">
      <div className="dk-entry-head">
        <Outcome outcome={record.outcome} practice={record.mode === "practice"} />
        <span className="type-caption text-ink-muted">#{record.seq} · {ago(record.decidedAtSec, nowSec)}</span>
      </div>
      <p className="type-body text-ink-secondary">{record.summary}</p>
    </Link>
  );
}

export function Rows({ rows, base, nowSec, zone }: { rows: RecordRow[]; base: string; nowSec: number; zone: string | null }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) =>
        row.kind === "entry" ? (
          <Entry key={row.record.seq} record={row.record} base={base} nowSec={nowSec} />
        ) : (
          <details key={`quiet-${row.records[0]?.seq}`} className="dk-quiet">
            <summary>{DESK.page.record.quiet(row.records.length, clock(row.fromSec, zone), clock(row.toSec, zone))}</summary>
            <div className="dk-quiet-list">
              {row.records.map((r) => (
                <Entry key={r.seq} record={r} base={base} nowSec={nowSec} quietLine />
              ))}
            </div>
          </details>
        ),
      )}
    </div>
  );
}

/** Item 7 (plan §5.7): the latest decisions with quiet runs folded, and the way to the whole record. */
export function RecordPanel({ records, base, nowSec, zone }: { records: readonly RecordSummaryWire[]; base: string; nowSec: number; zone: string | null }) {
  const R = DESK.page.record;
  return (
    <Panel title={R.title} aside={<Link href={`${base}/record`} className="dk-link type-caption">{R.whole}</Link>}>
      {records.length === 0 ? <p className="type-body text-ink-secondary">{R.empty}</p> : <Rows rows={foldQuietRuns(records)} base={base} nowSec={nowSec} zone={zone} />}
    </Panel>
  );
}
