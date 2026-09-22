"use client";

import { MANDATE_NOTES_MAX_CHARS, thresholdBps, type DeskMandate } from "@agari/core/desk";
import type { ReactNode } from "react";
import { DESK } from "./copy";
import type { StudioDraft } from "./draft";
import { pct } from "./format";

const L = DESK.studio.limits;

function Row({ text, by, children }: { text: string; by: "program" | "code"; children: ReactNode }) {
  return (
    <div className="dk-sentence">
      <label className="flex flex-col gap-1">
        <span className="dk-sentence-text">{text}</span>
        <span className="dk-chip" data-by={by}>{by === "program" ? L.program : L.code}</span>
      </label>
      {children}
    </div>
  );
}

/**
 * Step 02 (plan §5.4): the limits as plain sentences with the defaults filled in, each marked with who enforces it:
 * the program (per action, per day, the premium ceiling) or the desk's own code (drift, largest share, loss stop,
 * ask-first size). A notes box for the owner's own words.
 */
export function LimitsForm({ draft, setDraft, mandate }: { draft: StudioDraft; setDraft: (update: (d: StudioDraft) => StudioDraft) => void; mandate: DeskMandate | null }) {
  const field = (key: keyof StudioDraft, unit: "%" | "$") => (
    <span className="flex items-center gap-1">
      {unit === "$" && <span className="text-ink-muted">$</span>}
      <input className="dk-input" inputMode="decimal" value={String(draft[key])} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} aria-label={String(key)} />
      {unit === "%" && <span className="text-ink-muted">%</span>}
    </span>
  );
  const floor = mandate ? thresholdBps(mandate) : null;
  return (
    <div className="flex flex-col gap-6">
      <div className="dk-sentences">
        <Row text={L.drift(`${draft.driftPct}%`)} by="code">{field("driftPct", "%")}</Row>
        {floor !== null && floor > (mandate?.driftToleranceBps ?? 0) && <p className="type-caption text-ink-muted">{L.driftFloor(pct(floor))}</p>}
        <Row text={L.position(`${draft.positionPct}%`)} by="code">{field("positionPct", "%")}</Row>
        <Row text={L.perAction(`$${draft.perAction}`)} by="program">{field("perAction", "$")}</Row>
        <Row text={L.daily(`$${draft.daily}`)} by="program">{field("daily", "$")}</Row>
        <Row text={L.premium(`${draft.premiumPct}%`)} by="program">{field("premiumPct", "%")}</Row>
        <Row text={L.loss(`${draft.lossPct}%`)} by="code">{field("lossPct", "%")}</Row>
        <Row text={L.large(`$${draft.large}`)} by="code">{field("large", "$")}</Row>
      </div>
      <p className="type-caption text-ink-secondary">{L.programNote}</p>
      <p className="type-caption text-ink-secondary">{L.codeNote}</p>
      <label className="dk-field">
        <span>{L.notes}</span>
        <textarea className="dk-input dk-textarea" value={draft.notes} maxLength={MANDATE_NOTES_MAX_CHARS} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="never buy on a Sunday" />
        <span className="type-caption text-ink-muted normal-case tracking-normal">{L.notesHint} {L.count(draft.notes.length, MANDATE_NOTES_MAX_CHARS)}</span>
      </label>
    </div>
  );
}
