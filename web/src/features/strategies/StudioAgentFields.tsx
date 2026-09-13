"use client";

import { formatCadence } from "@masayume/core/copy";
import { AGENT_CADENCES_SEC, AGENT_PERSONA_MAX_CHARS, AGENT_POSTURES, describeSpec, POSTURES, type AgentPosture } from "@masayume/core/strategies";
import { cn } from "@/lib/utils";
import { STRATEGIES } from "./copy";
import { draftSpec, type StudioDraft } from "./studio-draft";
import "./desk.css";
import "./strategies.css";

const S = STRATEGIES.studio;
const A = STRATEGIES.studio.agent;
const RISK = STRATEGIES.desk.risk;

interface StudioAgentFieldsProps {
  form: StudioDraft;
  setForm: (update: (f: StudioDraft) => StudioDraft) => void;
  asset: string;
  decimals: number;
}

function toggleCadence(list: number[], cadence: number): number[] {
  const next = list.includes(cadence) ? list.filter((c) => c !== cadence) : [...list, cadence];
  return next.length === 0 ? list : next.sort((a, b) => a - b);
}

/**
 * Step 02 for an agent: the brief, gate posture and eligible Window cadences.
 */
export function StudioAgentFields({ form, setForm, asset }: StudioAgentFieldsProps) {
  const persona = form.persona;

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="desk-field-label mb-0">{A.persona}</span>
          <span className={cn("strat-mono-10 tabular-nums", persona.length >= AGENT_PERSONA_MAX_CHARS ? "text-vermilion" : "text-ink/40")}>{A.personaCount(persona.length, AGENT_PERSONA_MAX_CHARS)}</span>
        </div>
        <textarea
          value={persona}
          onChange={(e) => setForm((f) => ({ ...f, persona: e.target.value.slice(0, AGENT_PERSONA_MAX_CHARS) }))}
          placeholder={A.personaPlaceholder}
          maxLength={AGENT_PERSONA_MAX_CHARS}
          rows={6}
          className="strat-input strat-textarea text-ink"
          aria-label={A.persona}
          aria-describedby="strategy-persona-hint"
        />
        <div id="strategy-persona-hint" className="strat-mono-10 mt-1.5 text-ink/30">{A.personaHint}</div>
        {persona !== A.defaultPersona && (
          <button type="button" className="strat-sensei mt-3" onClick={() => setForm((f) => ({ ...f, persona: A.defaultPersona }))}>
            {A.restorePersona}
          </button>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <div className="desk-field-label">{A.posture}</div>
          <div className="desk-modes" role="radiogroup" aria-label={A.posture}>
            {AGENT_POSTURES.map((p: AgentPosture) => {
              const rules = POSTURES[p];
              const on = form.posture === p;
              return (
                <button key={p} type="button" role="radio" aria-checked={on} onClick={() => setForm((f) => ({ ...f, posture: p }))} className={cn("desk-mode", on && "desk-mode--on")}>
                  <span className={cn("desk-mode-label", on ? "text-ink" : "text-ink/60")}>{RISK[p][0]}</span>
                  <span className="desk-mode-detail">{A.postureDetail(Math.round(rules.minConfidence * 100), rules.maxPriceCents, rules.breakerLosses)}</span>
                </button>
              );
            })}
          </div>
          <div className="strat-mono-10 mt-1.5 text-ink/30">{A.postureHint}</div>
        </div>
        <div>
          <div className="desk-field-label">{A.cadences}</div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={A.cadences}>
            {AGENT_CADENCES_SEC.map((c) => (
              <button key={c} type="button" aria-pressed={form.cadences.includes(c)} onClick={() => setForm((f) => ({ ...f, cadences: toggleCadence(f.cadences, c) }))} className={cn("strat-chip", form.cadences.includes(c) && "strat-chip--on")}>
                {formatCadence(c)}
              </button>
            ))}
          </div>
          <div className="strat-mono-10 mt-1.5 text-ink/30">{A.cadencesHint}</div>
        </div>
      </div>

      <div className="rounded-lg border border-hairline bg-ink/[0.02] px-4 py-3">
        <div className="strat-micro mb-1.5 text-vermilion">{S.plain}</div>
        <p className="text-sm leading-snug text-ink-secondary">{describeSpec(draftSpec(form), asset)}</p>
        <ul className="strat-mono-10 mt-2 space-y-0.5 text-ink/40">
          {A.honesty.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

    </div>
  );
}
