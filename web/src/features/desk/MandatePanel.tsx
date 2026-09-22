"use client";

import { describeTargets, presetById } from "@agari/core/desk";
import Link from "next/link";
import { DESK } from "./copy";
import { Panel } from "./DeskPanels";
import { limitSentences } from "./draft";
import type { DeskView } from "./view";

/** Item 8 (plan §5.7): the basket and weights, the limits as sentences with who enforces each, the notes, and Edit. */
export function MandatePanel({ view }: { view: DeskView }) {
  const M = DESK.page.mandate;
  const L = DESK.studio.limits;
  const m = view.mandate;
  if (!m) return null;
  const preset = m.preset ? presetById(m.preset) : null;
  return (
    <Panel title={M.title} aside={<span className="type-caption text-ink-muted">{M.version(view.wire.mandate?.version ?? 1)}</span>}>
      <div className="dk-rows">
        <div className="dk-row"><span>{M.basket}</span><b>{preset?.name ?? DESK.studio.side.own}</b></div>
        <div className="dk-row"><span /><span className="text-right">{describeTargets(m.targets)}</span></div>
      </div>
      <div className="dk-sentences">
        {limitSentences(m).map((s) => (
          <div key={s.text} className="dk-sentence">
            <span className="dk-sentence-text">{s.text}</span>
            <span className="dk-chip" data-by={s.by}>{s.by === "program" ? L.program : L.code}</span>
          </div>
        ))}
      </div>
      {view.isOwner && (
        <div>
          <span className="dk-panel-title">{M.notes}</span>
          <p className="whitespace-pre-line type-body text-ink-secondary">{m.notes || M.noNotes}</p>
        </div>
      )}
      {view.isOwner && (
        <div className="dk-card-actions">
          <Link href="/desk/new?edit=1" className="dk-control">{M.edit}</Link>
          <span className="type-caption text-ink-muted">{M.editNote}</span>
        </div>
      )}
    </Panel>
  );
}
