"use client";

import { describeSpec, isSpec, PRESETS } from "@masayume/core/strategies";
import { parseDecimalToBaseUnits } from "@masayume/core/units";
import { txUrl } from "@masayume/core/urls";
import { useEffect, useState } from "react";
import { ConnectButton } from "@/features/markets/wallet";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { AgentPortrait } from "./AgentPortrait";
import { DryReadPanel } from "./DryReadPanel";
import { codenameFromAddress } from "./names";
import { draftSpec, initialStudioDraft, studioReadKey } from "./studio-draft";
import { StudioForm } from "./StudioForm";
import { useDryRead } from "./useDryRead";
import type { DeskWriteResult, useDeskWrites } from "./useDeskWrites";
import "./builder.css";

const STEPS = ["Identity & approach", "Behavior & limits", "Test read", "Publish"];
interface CreatorStudioProps {
  writes: ReturnType<typeof useDeskWrites>;
  decimals: number;
  symbol: string;
  asset: string;
  houseRunner: string | null;
  onPublished?: () => void;
}

/** Drafting is public; only publishing needs the creator's connected wallet. */
export function CreatorStudio({ writes, decimals, symbol, asset, houseRunner, onPublished }: CreatorStudioProps) {
  const [form, setForm] = useState(() => initialStudioDraft(houseRunner));
  const [step, setStep] = useState(1);
  const [published, setPublished] = useState<DeskWriteResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const dry = useDryRead(studioReadKey(form));
  const successfulRead = dry.state.status === "ok" && dry.state.result.verdict !== null;
  useEffect(() => {
    setForm((f) => f.portraitSeed === "masayume-new-agent" ? { ...f, portraitSeed: crypto.randomUUID() } : f);
  }, []);
  const runner = form.hosting === "house" ? houseRunner : form.agent.trim();
  const name = form.name.trim() || codenameFromAddress(form.portraitSeed);
  const spec = draftSpec(form);
  const perTrade = parseDecimalToBaseUnits(form.maxPerTrade, decimals);
  const daily = parseDecimalToBaseUnits(form.maxDaily, decimals);
  const fee = parseDecimalToBaseUnits(form.subFee, decimals);
  const behaviorValid = isSpec(spec) && perTrade !== null && perTrade > 0n && daily !== null && daily >= perTrade;
  const runnerValid = Boolean(runner && /^0x[0-9a-fA-F]{40}$/.test(runner));
  const summary = spec.preset === "agent" ? describeSpec(spec, asset) : `Follows the EMA move from each Window’s opening print when it reaches ${form.thresholdPct}%. Considers all live venue assets.`;
  const canPublish = behaviorValid && runnerValid && fee !== null && fee >= 0n;
  const advance = () => {
    if (step === 2 && !behaviorValid) { setProblem("Complete the brief and choose positive limits. The daily limit must cover one trade."); return; }
    setProblem(null); setStep((value) => Math.min(4, value + 1));
  };
  const testRead = () => {
    if (spec.preset !== "agent" || !behaviorValid || !perTrade) return;
    void dry.read({ persona: spec.persona, posture: spec.posture, cadences: spec.cadences, stakeBase: perTrade.toString() });
  };
  const publish = async () => {
    if (!canPublish || !runner || perTrade === null || daily === null || fee === null || published) return;
    setProblem(null);
    const metadata = { name, portraitSeed: form.portraitSeed, description: summary, spec, ...(form.playbook.trim() ? { playbook: form.playbook.trim() } : {}) };
    const result = await writes.publish({ kind: "strategy-publish", runner: runner as `0x${string}`, spec, metadata, envelope: { maxStakePerTradeBase: perTrade, maxDailySpendBase: daily, maxOpenPositions: 2, maxPriceRaw: 0n }, feeBase: fee });
    if (result.ok || result.unknown) setPublished(result);
    else setProblem(result.reason ?? "Publishing did not complete. Your draft is still here.");
    if (result.ok) notify.neutral("Strategy published. Set up a funded copy to enable trading.");
  };

  if (published) return (
    <section className="agent-builder agent-published" aria-live="polite">
      <AgentPortrait seed={form.portraitSeed} name={name} />
      <div><p className="strat-micro text-vermilion">{published.ok ? "Published on Somnia" : "Publication needs checking"}</p><h2 className="strat-h2 mt-2 text-ink">{name}</h2></div>
      <p className="strat-choice-body">{published.ok ? "Your strategy is registered. Publishing has not deposited money or enabled trades from your wallet." : "The transaction result is uncertain. Check the receipt and Your strategies before publishing again."}</p>
      {published.txHash && <a className="strat-sensei" href={txUrl(published.txHash)} target="_blank" rel="noopener noreferrer">View publication transaction ↗</a>}
      <ol className="agent-next-steps"><li>Open Your strategies and select this agent.</li><li>Choose a copy budget, review the fee and approve its bounded permission.</li><li>Wait for the runner’s first real decision. A held call is a valid result; a fill has its own transaction.</li></ol>
      <button type="button" className="strat-confirm strat-confirm--live" onClick={onPublished}>View your strategies →</button>
      {published.ok && <button type="button" className="strat-sensei" onClick={() => { setForm({ ...initialStudioDraft(houseRunner), portraitSeed: crypto.randomUUID() }); setPublished(null); setProblem(null); setStep(1); dry.reset(); }}>Create another agent →</button>}
    </section>
  );

  return (
    <section className="agent-builder" aria-label="Create an agent">
      <div className="agent-builder-heading"><div><p className="strat-micro text-vermilion">Creator studio</p><h2 className="strat-h2 mt-2 text-ink">Give your agent a way to think.</h2></div><p className="strat-choice-body">Build your brief, try a read, then publish. Connect your wallet when you are ready to sign.</p></div>
      <ol className="agent-steps" aria-label="Creation progress">{STEPS.map((label, index) => <li key={label} aria-current={step === index + 1 ? "step" : undefined}><button type="button" onClick={() => { if (index + 1 < step) { setProblem(null); setStep(index + 1); } }} disabled={index + 1 >= step}><span>{String(index + 1).padStart(2, "0")}</span>{label}</button></li>)}</ol>
      <div className="agent-builder-grid">
        <div className="agent-builder-panel">
          <h3 className="strat-choice-title mb-5 text-ink">{STEPS[step - 1]}</h3>
          {step === 3 ? <div className="space-y-5">
            {form.preset === "agent" ? <><p className="strat-choice-body">Make one real model read using this brief and per-trade cap. Nothing is signed or traded. Changing the behavior or limits clears this result.</p><button type="button" onClick={testRead} disabled={dry.state.status === "reading" || !behaviorValid} className="strat-sensei">{dry.state.status === "reading" ? "Reading a live Window…" : "Run test read →"}</button><DryReadPanel state={dry.state} />{!successfulRead && <p className="strat-mono-11 text-ink-muted">You can publish without a successful test. The runner will still need readable markets and a working model.</p>}</> : <><p className="strat-micro text-vermilion">Rule preview · no live market read</p><p className="strat-choice-body">{summary}</p><div className="agent-rule-preview"><span>Move ≥ +{form.thresholdPct}% → UP</span><span>Move ≤ −{form.thresholdPct}% → DOWN</span><span>Smaller move → HOLD</span></div><p className="strat-choice-body">This checks the configured rule, not today’s market or a fill. The live runner still checks time, book depth and your permission.</p></>}
          </div> : <StudioForm step={step} form={form} setForm={setForm} decimals={decimals} symbol={symbol} asset={asset} houseRunner={houseRunner} />}
          {problem && <p className="agent-form-error" role="alert">{problem}</p>}
          <div className="agent-builder-actions">
            {step > 1 && <button type="button" onClick={() => { setStep((value) => value - 1); setProblem(null); }} className="strat-sensei">← Back</button>}
            {step < 4 ? <button type="button" onClick={advance} className="strat-confirm strat-confirm--live">{step === 3 && form.preset === "agent" && !successfulRead ? "Continue without a test result →" : "Continue →"}</button> : writes.address ? <button type="button" onClick={publish} disabled={!canPublish || Boolean(writes.busy) || !writes.canSign} className={cn("strat-confirm", canPublish ? "strat-confirm--live" : "strat-confirm--dead")}>{writes.busy === "publish" ? "Confirming publication…" : "Publish agent →"}</button> : <ConnectButton />}
          </div>
          {step === 4 && <p className="strat-mono-11 mt-4 text-ink-muted">One publication transaction. Funding and copy permission are separate steps. Test collateral only.</p>}
        </div>
        <aside className="strat-preview agent-builder-preview"><p className="strat-micro text-ink-muted">Your agent</p><div className="mt-4 flex items-center gap-3"><AgentPortrait seed={form.portraitSeed} name={name} /><div className="min-w-0"><h3 className="strat-choice-title break-words text-ink">{name}</h3><p className="strat-mono-11 mt-1 text-ink-muted">{PRESETS[form.preset].name}</p></div></div><dl className="agent-preview-facts"><div><dt>Most per trade</dt><dd>{form.maxPerTrade || "—"} {symbol}</dd></div><div><dt>Most per day</dt><dd>{form.maxDaily || "—"} {symbol}</dd></div><div><dt>Market scope</dt><dd>All live venue assets</dd></div><div><dt>Test read</dt><dd>{form.preset === "momentum" ? "Rule preview" : successfulRead ? "Completed for this draft" : dry.state.status === "reading" ? "Reading…" : "Not verified"}</dd></div></dl><p className="strat-choice-body">Your name and portrait stay with the published strategy across the desk, cards and copy settings.</p></aside>
      </div>
    </section>
  );
}
