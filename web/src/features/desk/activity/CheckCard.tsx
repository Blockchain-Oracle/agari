"use client";

import { ChevronDown, ChevronRight, CircleDashed } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LogoStack } from "@/components/ui/desk-kit";
import { RECORD } from "../copy-record";
import { ago, clock } from "../format";
import { figureParts, type CheckGroup, type CheckLine } from "./check-groups";
import { ACTIVITY } from "./copy-activity";
import "./activity.css";

/** A line's text with its figures set in the data face, so "29.9%" and "$250" stand out on a scan. */
export function Figures({ text }: { text: string }) {
  return (
    <>
      {figureParts(text).map((p, i) =>
        p.figure ? (
          <b key={i} className="act-figure">{p.text}</b>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function Line({ line, base, open }: { line: CheckLine; base: string; open: boolean }) {
  return (
    <li>
      <Link href={`${base}/decision/${line.record.seq}`} className="act-line" data-tone={line.tone}>
        <span className="act-line-mark">{line.symbol ? <LogoStack symbols={[line.symbol]} size="sm" max={1} /> : <CircleDashed aria-hidden />}</span>
        <span className="act-line-text">
          <span className="act-line-top">
            <span className="act-badge" data-tone={line.tone}>{RECORD.outcome[line.record.outcome]}</span>
            {line.repeats > 1 && <span className="act-tag">{ACTIVITY.repeats(line.repeats)}</span>}
          </span>
          <span className="act-line-lead"><Figures text={line.lead} /></span>
          {open && line.rest !== "" && <span className="act-line-rest"><Figures text={line.rest} /></span>}
        </span>
        <ChevronRight className="act-line-go" aria-hidden />
      </Link>
    </li>
  );
}

/**
 * One check as a card (21st's Activity Feed #29394 over the record): the time, then a line per company with its
 * verdict as a badge and the fact in one sentence, figures picked out. The reasons stay folded until "Why" opens them;
 * each line opens its full decision.
 */
export function CheckCard({ group, base, nowSec, zone }: { group: CheckGroup; base: string; nowSec: number; zone: string | null }) {
  const [open, setOpen] = useState(false);
  const why = group.lines.some((l) => l.rest !== "");
  const practice = group.lines.some((l) => l.record.mode === "practice");
  const first = Math.min(...group.seqs);
  const last = Math.max(...group.seqs);
  return (
    <div className="act-check" data-tone={group.tone}>
      <div className="act-check-head">
        <span className="act-time">{clock(group.atSec, zone)}</span>
        {practice && <span className="act-tag">{RECORD.list.practiceTag}</span>}
        <span className="act-meta">{ago(group.atSec, nowSec)} · #{first === last ? first : `${first}–${last}`}</span>
      </div>
      <ul className="act-lines">
        {group.lines.map((l) => (
          <Line key={l.record.seq} line={l} base={base} open={open} />
        ))}
      </ul>
      {why && (
        <button type="button" className="act-why" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? ACTIVITY.hideWhy : ACTIVITY.why}
          <ChevronDown className="act-quiet-chevron" data-open={open ? "" : undefined} aria-hidden />
        </button>
      )}
    </div>
  );
}
