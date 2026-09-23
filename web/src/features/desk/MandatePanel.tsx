"use client";

import { describeTargets, nameOf } from "@agari/core/desk";
import { CalendarClock, Coins, Hand, PieChart, ShieldAlert, ShieldCheck, TrendingUp, Waves, Cpu, NotebookPen, PencilLine } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { LogoStack, PartitionBar } from "@/components/ui/desk-kit";
import { basketOf } from "./cockpit/CockpitHeader";
import { COCKPIT } from "./cockpit/copy-cockpit";
import { brandColor } from "./cockpit/OverviewTab";
import { DESK } from "./copy";
import { Panel } from "./DeskPanels";
import { limitSentences } from "./draft";
import type { DeskView } from "./view";

const R = COCKPIT.rules;
/** `limitSentences` returns the seven rules in a fixed order: wander, one company, one action, a day, premium, loss, ask. */
const RULE_ICONS: readonly ReactNode[] = [<Waves key="w" />, <PieChart key="p" />, <Coins key="c" />, <CalendarClock key="d" />, <TrendingUp key="t" />, <ShieldAlert key="s" />, <Hand key="h" />];

/** Item 8 (plan §5.7) as the Rules tab: the basket, each limit as a card saying who enforces it, notes, Edit, the promise. */
export function RulesTab({ view }: { view: DeskView }) {
  const M = DESK.page.mandate;
  const m = view.mandate;
  const b = basketOf(view);
  return (
    <div className="cp-rules">
      {m && (
        <Panel title={R.basket} aside={<span className="type-caption text-ink-muted">{M.version(view.wire.mandate?.version ?? 1)}</span>}>
          <div className="cp-basket">
            <LogoStack symbols={b.members} size="lg" max={5} names={b.members.map((s) => nameOf(s as never))} />
            <div className="cp-basket-text">
              <span className="cp-holding-name">{b.name}</span>
              <span className="type-caption text-ink-secondary">{describeTargets(m.targets)}</span>
            </div>
          </div>
          <PartitionBar
            label={describeTargets(m.targets)}
            height={10}
            slices={[...m.targets.tokens.map((t) => ({ id: t.symbol, label: nameOf(t.symbol), value: t.weightBps, color: brandColor(t.symbol) })), { id: "cash", label: COCKPIT.overview.cash, value: m.targets.cashBps, color: "var(--color-ink-muted)" }]}
          />
        </Panel>
      )}
      {m && (
        <div className="cp-rule-grid">
          {limitSentences(m).map((s, i) => (
            <div key={s.text} className="cp-rule" data-by={s.by}>
              <span className="cp-rule-icon" aria-hidden>{RULE_ICONS[i]}</span>
              <span className="cp-rule-text">{s.text}</span>
              <span className="cp-rule-badge" data-by={s.by}>
                {s.by === "program" ? <ShieldCheck /> : <Cpu />}
                {s.by === "program" ? R.program : R.code}
              </span>
            </div>
          ))}
        </div>
      )}
      {m && view.isOwner && (
        <Panel title={M.notes} aside={<Link href="/desk/new?edit=1" className="cp-edit"><PencilLine /> {R.edit}</Link>}>
          <p className="cp-notes"><NotebookPen /> <span className="whitespace-pre-line">{m.notes || M.noNotes}</span></p>
          <p className="type-caption text-ink-muted">{M.editNote}</p>
        </Panel>
      )}
      <Panel title={DESK.promise.title} className="cp-promise">
        <ol className="cp-promise-list">
          {DESK.promise.points.map((point) => (
            <li key={point}><ShieldCheck /> <span>{point}</span></li>
          ))}
        </ol>
        <p className="type-caption text-ink-muted">{DESK.promise.worstCase}</p>
      </Panel>
    </div>
  );
}
