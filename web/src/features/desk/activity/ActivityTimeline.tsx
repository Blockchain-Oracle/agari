"use client";

import { Ban, Check, ChevronDown, CircleDashed, Hand, Moon, OctagonAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { EmptyState, Timeline, TimelineDay, TimelineNode, type NodeTone } from "@/components/ui/desk-kit";
import { ago, clock } from "../format";
import type { RecordSummaryWire } from "../protocol";
import { CheckCard, Figures } from "./CheckCard";
import { checkRows, groupChecks, TONE, type CheckRow } from "./check-groups";
import { ACTIVITY, FILTERS, type ActivityFilter } from "./copy-activity";
import { dayKey, dayLabel } from "./activity-model";
import "./activity.css";

const ICON: Record<NodeTone, ReactNode> = {
  acted: <Check strokeWidth={2.75} />, declined: <Ban />, quiet: <CircleDashed />, asked: <Hand />, stopped: <OctagonAlert />, error: <OctagonAlert />, neutral: <CircleDashed />,
};

const FILTER_TONES: Record<ActivityFilter, readonly NodeTone[] | null> = { all: null, acted: ["acted"], declined: ["declined"], asked: ["asked"], quiet: ["quiet"], problems: ["error", "stopped"] };

function QuietRun({ row, base, nowSec, zone, index }: { row: Extract<CheckRow, { kind: "quiet" }>; base: string; nowSec: number; zone: string | null; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <TimelineNode icon={<Moon />} tone="quiet" index={index}>
      <button type="button" className="act-quiet" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{ACTIVITY.quietRun(row.groups.length, clock(row.fromSec, zone), clock(row.toSec, zone))}</span>
        <ChevronDown className="act-quiet-chevron" data-open={open ? "" : undefined} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul className="act-quiet-list" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
            {row.groups.flatMap((g) =>
              g.lines.map((l) => (
                <li key={l.record.seq}>
                  <Link href={`${base}/decision/${l.record.seq}`} className="act-quiet-line">
                    <span><Figures text={l.lead} /></span>
                    <span className="act-meta">{clock(g.atSec, zone)} · {ago(g.atSec, nowSec)}</span>
                  </Link>
                </li>
              )),
            )}
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

/**
 * The desk's activity (S22, D-127): 21st's Interactive Timeline (#28276) and Agent Activity (#29318) over the record.
 * Each check is one node (a check writes a record per company it looked at): its time, then a card with a line per
 * company, verdict as a badge, the fact in one sentence, reasons folded. Days are headed; runs of quiet checks fold
 * into one node that opens. Shared by the cockpit's Activity tab and `/record`.
 */
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
  const rows: CheckRow[] = useMemo(() => {
    const groups = groupChecks(shown);
    return filter === "all" ? checkRows(groups) : groups.map((group) => ({ kind: "check", group }));
  }, [shown, filter]);

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
          const atSec = row.kind === "check" ? row.group.atSec : row.toSec;
          const key = dayKey(atSec, zone);
          const nodes: ReactNode[] = [];
          if (key !== lastDay) {
            lastDay = key;
            nodes.push(<TimelineDay key={`day-${key}`}>{dayLabel(atSec, nowSec, zone)}</TimelineDay>);
          }
          nodes.push(
            row.kind === "check" ? (
              <TimelineNode key={row.group.seqs[0]} icon={ICON[row.group.tone]} tone={row.group.tone} index={i}>
                <CheckCard group={row.group} base={base} nowSec={nowSec} zone={zone} />
              </TimelineNode>
            ) : (
              <QuietRun key={`q-${row.groups[0]?.seqs[0]}`} row={row} base={base} nowSec={nowSec} zone={zone} index={i} />
            ),
          );
          return nodes;
        })}
      </Timeline>
    </div>
  );
}
