"use client";

import type { OutcomeColumn } from "@agari/core/desk";
import { Ban, Check, ChevronDown, CircleDashed, Hand, Moon, OctagonAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { EmptyState, LogoStack, Timeline, TimelineDay, TimelineNode, type NodeTone } from "@/components/ui/desk-kit";
import { RECORD } from "../copy-record";
import { ago, clock } from "../format";
import type { RecordSummaryWire } from "../protocol";
import { foldQuietRuns, type RecordRow } from "../record-rows";
import { ACTIVITY, FILTERS, type ActivityFilter } from "./copy-activity";
import { dayKey, dayLabel, namesIn } from "./activity-model";
import "./activity.css";

/**
 * The desk's activity (S22, D-127): 21st's Interactive Timeline (#28276) and Agent Activity (#29318) over the record.
 * Every check is a node with its verdict's icon, the companies it was about, the one-line reason and its #seq; days
 * are headed; quiet runs fold into one node that opens. Shared by the cockpit's Activity tab and `/record`.
 */
export const TONE: Record<OutcomeColumn, NodeTone> = {
  acted: "acted", acted_in_part: "acted", acted_by_override: "acted", would_have_acted: "acted",
  asked: "asked", declined: "declined", nothing_to_do: "quiet", waited: "quiet",
  not_executed: "error", blocked_by_limit: "stopped", failed: "error",
};

const ICON: Record<NodeTone, ReactNode> = {
  acted: <Check strokeWidth={2.75} />, declined: <Ban />, quiet: <CircleDashed />, asked: <Hand />, stopped: <OctagonAlert />, error: <OctagonAlert />, neutral: <CircleDashed />,
};

const FILTER_TONES: Record<ActivityFilter, readonly NodeTone[] | null> = { all: null, acted: ["acted"], declined: ["declined"], asked: ["asked"], quiet: ["quiet"], problems: ["error", "stopped"] };

function Entry({ record, base, nowSec, index }: { record: RecordSummaryWire; base: string; nowSec: number; index: number }) {
  const tone = TONE[record.outcome];
  const names = namesIn(record.summary);
  return (
    <TimelineNode icon={ICON[tone]} tone={tone} index={index}>
      <Link href={`${base}/decision/${record.seq}`} className="act-entry" data-tone={tone}>
        <span className="act-entry-head">
          <span className="act-verdict" data-tone={tone}>{RECORD.outcome[record.outcome]}</span>
          {record.mode === "practice" && <span className="act-tag">{RECORD.list.practiceTag}</span>}
          <span className="act-meta">#{record.seq} · {ago(record.decidedAtSec, nowSec)}</span>
        </span>
        <span className="act-entry-body">
          {names.length > 0 && <LogoStack symbols={names} size="sm" max={3} />}
          <span className="act-summary">{record.summary}</span>
        </span>
      </Link>
    </TimelineNode>
  );
}

function QuietRun({ row, base, nowSec, zone, index }: { row: Extract<RecordRow, { kind: "quiet" }>; base: string; nowSec: number; zone: string | null; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <TimelineNode icon={<Moon />} tone="quiet" index={index}>
      <button type="button" className="act-quiet" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{ACTIVITY.quietRun(row.records.length, clock(row.fromSec, zone), clock(row.toSec, zone))}</span>
        <ChevronDown className="act-quiet-chevron" data-open={open ? "" : undefined} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul className="act-quiet-list" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
            {row.records.map((r) => (
              <li key={r.seq}>
                <Link href={`${base}/decision/${r.seq}`} className="act-quiet-line">
                  <span>{r.summary}</span>
                  <span className="act-meta">#{r.seq} · {ago(r.decidedAtSec, nowSec)}</span>
                </Link>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </TimelineNode>
  );
}

export interface ActivityTimelineProps {
  records: readonly RecordSummaryWire[];
  base: string;
  nowSec: number;
  zone: string | null;
  /** Show the filter chips (the whole record and the Activity tab both do). */
  filters?: boolean;
  empty?: ReactNode;
}

export function ActivityTimeline({ records, base, nowSec, zone, filters = true, empty }: ActivityTimelineProps) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const counts = useMemo(() => {
    const c: Record<ActivityFilter, number> = { all: records.length, acted: 0, declined: 0, asked: 0, quiet: 0, problems: 0 };
    for (const r of records) {
      const tone = TONE[r.outcome];
      for (const f of FILTERS) if (f !== "all" && FILTER_TONES[f]?.includes(tone)) c[f] += 1;
    }
    return c;
  }, [records]);
  const shown = useMemo(() => {
    const tones = FILTER_TONES[filter];
    return tones ? records.filter((r) => tones.includes(TONE[r.outcome])) : records;
  }, [records, filter]);
  // Quiet runs fold only in the unfiltered view: a "Quiet" filter wants every quiet check as its own node.
  const rows: RecordRow[] = filter === "all" ? foldQuietRuns(shown) : shown.map((record) => ({ kind: "entry", record }));

  if (records.length === 0) return <>{empty ?? <EmptyState icon={<CircleDashed />} title={ACTIVITY.emptyTitle} body={ACTIVITY.emptyBody} />}</>;
  let lastDay = "";
  return (
    <div className="act">
      {filters && (
        <div className="act-filters" role="group" aria-label={ACTIVITY.filtersAria}>
          {FILTERS.filter((f) => f === "all" || counts[f] > 0).map((f) => (
            <button key={f} type="button" className="act-filter" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {ACTIVITY.filter[f]}
              <span className="act-filter-count">{counts[f]}</span>
            </button>
          ))}
        </div>
      )}
      <Timeline label={ACTIVITY.aria}>
        {rows.flatMap((row, i) => {
          const atSec = row.kind === "entry" ? row.record.decidedAtSec : row.toSec;
          const key = dayKey(atSec, zone);
          const nodes: ReactNode[] = [];
          if (key !== lastDay) {
            lastDay = key;
            nodes.push(<TimelineDay key={`day-${key}`}>{dayLabel(atSec, nowSec, zone)}</TimelineDay>);
          }
          nodes.push(row.kind === "entry" ? <Entry key={row.record.seq} record={row.record} base={base} nowSec={nowSec} index={i} /> : <QuietRun key={`q-${row.records[0]?.seq}`} row={row} base={base} nowSec={nowSec} zone={zone} index={i} />);
          return nodes;
        })}
      </Timeline>
    </div>
  );
}
