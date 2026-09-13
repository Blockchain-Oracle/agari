"use client";

import { PRESETS } from "@masayume/core/strategies";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STRATEGIES } from "./copy";
import type { StudioDraft } from "./studio-draft";
import { StudioAgentFields } from "./StudioAgentFields";
import "./strategies.css";

export { draftSpec, type StudioDraft } from "./studio-draft";
const S = STRATEGIES.studio;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="desk-field-label">{label}</span>{children}</label>;
}

interface StudioFormProps {
  form: StudioDraft;
  setForm: (update: (f: StudioDraft) => StudioDraft) => void;
  symbol: string;
  asset: string;
  decimals: number;
  houseRunner: string | null;
  step: number;
}

/** Three editable panels; the independent Test read panel is owned by CreatorStudio. */
export function StudioForm({ form, setForm, symbol, asset, decimals, houseRunner, step }: StudioFormProps) {
  if (step === 1) return (
    <div className="space-y-6">
      <Field label="Agent name"><input value={form.name} maxLength={64} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Give your agent a name" className="strat-input text-ink" /></Field>
      <div>
        <div className="desk-field-label">Trading approach</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["agent", "momentum"] as const).map((preset) => (
            <button key={preset} type="button" aria-pressed={form.preset === preset} onClick={() => setForm((f) => ({ ...f, preset }))} className={cn("strat-choice group", form.preset === preset && "strat-choice--on")}>
              <span className="strat-choice-title text-ink">{PRESETS[preset].name}</span>
              <p className="strat-choice-body">{preset === "agent" ? "An AI reads the opening price, recent move and order books, then explains its call. Hard limits still decide what it may trade." : "A fixed rule follows the current EMA price away from each Window’s opening print. No AI model is used."}</p>
            </button>
          ))}
        </div>
      </div>
      <p className="strat-choice-body">Market scope: all live assets in this deployment’s venue. The runner chooses eligible Windows; this form does not restrict it to one coin.</p>
      <button type="button" className="strat-sensei" onClick={() => setForm((f) => ({ ...f, portraitSeed: crypto.randomUUID() }))}>Choose another portrait</button>
    </div>
  );
  if (step === 2) return (
    <div className="space-y-6">
      {form.preset === "agent" ? <StudioAgentFields form={form} setForm={setForm} asset={asset} decimals={decimals} /> : (
        <div>
          <div className="desk-field-label">Minimum move from the opening price</div>
          <div className="flex flex-wrap gap-2">{["0.1", "0.2", "0.5", "1"].map((value) => <button type="button" key={value} aria-pressed={form.thresholdPct === value} onClick={() => setForm((f) => ({ ...f, thresholdPct: value }))} className={cn("strat-chip", form.thresholdPct === value && "strat-chip--on")}>{value}%</button>)}</div>
          <p className="strat-choice-body mt-3">A move above this threshold may produce an UP call; a move below its negative may produce DOWN. The strategy waits when the move is smaller. Each Window is considered once.</p>
        </div>
      )}
      <div className="border-t border-hairline pt-5">
        <h3 className="strat-choice-title mb-4 text-ink">Hard spending limits</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${S.perTrade} (${symbol})`}><input inputMode="decimal" value={form.maxPerTrade} onChange={(e) => setForm((f) => ({ ...f, maxPerTrade: e.target.value }))} className="strat-input text-ink" /></Field>
          <Field label={`${S.daily} (${symbol})`}><input inputMode="decimal" value={form.maxDaily} onChange={(e) => setForm((f) => ({ ...f, maxDaily: e.target.value }))} className="strat-input text-ink" /></Field>
        </div>
        <p className="strat-choice-body mt-3">At most two open positions per follower. Followers can set tighter limits and revoke permission. Creating an agent does not fund it.</p>
      </div>
    </div>
  );
  return (
    <div className="space-y-6">
      <div>
        <div className="desk-field-label">Who runs it</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["house", "self"] as const).map((hosting) => <button key={hosting} type="button" disabled={hosting === "house" && !houseRunner} aria-pressed={form.hosting === hosting} onClick={() => setForm((f) => ({ ...f, hosting }))} className={cn("strat-choice group", form.hosting === hosting && "strat-choice--on")}><span className="strat-choice-title text-ink">{hosting === "house" ? "Let Masayume run it" : "Run your own bot"}</span><p className="strat-choice-body">{hosting === "house" ? houseRunner ? "The hosted runner discovers your published strategy. A follower’s funded permission enables trading." : "A house runner is not configured on this deployment." : "Publish with the address of your own running bot. You operate its process and model credentials."}</p></button>)}
        </div>
        {form.hosting === "self" && <div className="mt-4"><Field label="Runner wallet"><input value={form.agent} onChange={(e) => setForm((f) => ({ ...f, agent: e.target.value }))} placeholder="0x…" className="strat-input text-ink" /></Field></div>}
      </div>
      <Field label={`Subscription fee (${symbol})`}><input inputMode="decimal" value={form.subFee} onChange={(e) => setForm((f) => ({ ...f, subFee: e.target.value }))} className="strat-input text-ink" /></Field>
      <p className="strat-choice-body">The registry charges this fee to a follower on every subscription, including a resume or a limits change. Set 0 for free subscriptions.</p>
      <Field label="Public playbook · optional"><textarea value={form.playbook} onChange={(e) => setForm((f) => ({ ...f, playbook: e.target.value }))} className="strat-input strat-textarea text-ink" maxLength={4000} /></Field>
      <p className="strat-choice-body">Your name, brief, playbook and runner address are public. Keep secrets and private instructions out of them.</p>
    </div>
  );
}
