"use client";

import { MANDATE_NOTES_MAX_CHARS, thresholdBps, type DeskMandate } from "@agari/core/desk";
import { Gauge, ShieldCheck, Wind } from "lucide-react";
import { RadioCards, Slider, type RadioCardItem } from "@/components/ui/desk-kit";
import { DESK } from "./copy";
import type { StudioDraft } from "./draft";
import { pct } from "./format";
import { STUDIO } from "./studio/copy-studio";
import { numberOf, STRICTNESS, strictnessOf, type Strictness } from "./studio/studio-model";

const L = DESK.studio.limits;
const S = STUDIO.strictness;

type Key = "driftPct" | "positionPct" | "lossPct" | "premiumPct" | "perAction" | "daily" | "large";
interface Spec {
  key: Key;
  sentence: (v: string) => string;
  by: "program" | "code";
  unit: "%" | "$";
  min: number;
  max: number;
  step: number;
}

const MONEY: readonly Spec[] = [
  { key: "perAction", sentence: L.perAction, by: "program", unit: "$", min: 5, max: 1_000, step: 5 },
  { key: "daily", sentence: L.daily, by: "program", unit: "$", min: 5, max: 5_000, step: 5 },
  { key: "premiumPct", sentence: L.premium, by: "program", unit: "%", min: 1, max: 50, step: 1 },
  { key: "large", sentence: L.large, by: "code", unit: "$", min: 5, max: 2_000, step: 5 },
];
const SHAPE: readonly Spec[] = [
  { key: "driftPct", sentence: L.drift, by: "code", unit: "%", min: 1, max: 20, step: 0.5 },
  { key: "positionPct", sentence: L.position, by: "code", unit: "%", min: 10, max: 100, step: 5 },
  { key: "lossPct", sentence: L.loss, by: "code", unit: "%", min: 5, max: 50, step: 1 },
];

const ICONS: Record<Strictness, React.ReactNode> = { careful: <ShieldCheck className="size-5" />, balanced: <Gauge className="size-5" />, loose: <Wind className="size-5" /> };

const shown = (spec: Spec, text: string): string => (spec.unit === "$" ? `$${text}` : `${text}%`);

function LimitRow({ spec, draft, setDraft }: { spec: Spec; draft: StudioDraft; setDraft: (update: (d: StudioDraft) => StudioDraft) => void }) {
  const text = draft[spec.key];
  const value = Math.min(spec.max, Math.max(spec.min, numberOf(text, spec.min)));
  return (
    <li className="st-limit">
      <div className="st-limit-head">
        <span className="st-limit-sentence">{spec.sentence(shown(spec, text))}</span>
        <span className="st-by" data-by={spec.by}>{spec.by === "program" ? S.program : S.code}</span>
      </div>
      <Slider value={value} onChange={(v) => setDraft((d) => ({ ...d, [spec.key]: String(v) }))} min={spec.min} max={spec.max} step={spec.step} label={spec.sentence(shown(spec, text))} display={shown(spec, text)} />
    </li>
  );
}

/**
 * Step 02 (plan §5.4, redesigned in S22): pick how strict as one of three cards, then fine-tune every limit on its
 * slider. Each limit is its own sentence with who enforces it: the program on-chain (per action, per day, the premium
 * ceiling) or the desk's own code (drift, largest share, loss stop, ask-first size). A notes box for your own words.
 */
export function LimitsForm({ draft, setDraft, mandate }: { draft: StudioDraft; setDraft: (update: (d: StudioDraft) => StudioDraft) => void; mandate: DeskMandate | null }) {
  const floor = mandate ? thresholdBps(mandate) : null;
  const level = strictnessOf(draft);
  const items: RadioCardItem<Strictness>[] = (Object.keys(STRICTNESS) as Strictness[]).map((k) => ({
    value: k,
    media: <span className="st-icon-tile" data-level={k}>{ICONS[k]}</span>,
    title: S.presets[k].title,
    body: S.presets[k].line,
  }));
  return (
    <div className="flex flex-col gap-8">
      <section className="st-block" aria-label={S.aria}>
        <div className="st-block-head">
          <span className="st-label">{S.title}</span>
          {level === null && <span className="st-hint">{S.custom}</span>}
        </div>
        <RadioCards value={level} onChange={(k) => setDraft((d) => ({ ...d, ...STRICTNESS[k] }))} items={items} label={S.aria} className="st-strict" />
      </section>

      <section className="st-block">
        <span className="st-label">{S.moneyTitle}</span>
        <ul className="st-limits">
          {MONEY.map((spec) => <LimitRow key={spec.key} spec={spec} draft={draft} setDraft={setDraft} />)}
        </ul>
        <p className="st-hint">{L.programNote}</p>
      </section>

      <section className="st-block">
        <span className="st-label">{S.shapeTitle}</span>
        <ul className="st-limits">
          {SHAPE.map((spec) => <LimitRow key={spec.key} spec={spec} draft={draft} setDraft={setDraft} />)}
        </ul>
        {floor !== null && floor > (mandate?.driftToleranceBps ?? 0) && <p className="st-hint">{L.driftFloor(pct(floor))}</p>}
        <p className="st-hint">{L.codeNote}</p>
      </section>

      <label className="st-block">
        <span className="st-label">{L.notes}</span>
        <textarea className="dk-input dk-textarea st-notes" value={draft.notes} maxLength={MANDATE_NOTES_MAX_CHARS} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="never buy on a Sunday" />
        <span className="st-hint">{L.notesHint} {L.count(draft.notes.length, MANDATE_NOTES_MAX_CHARS)}</span>
      </label>
    </div>
  );
}
