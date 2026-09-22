"use client";

import type { Address } from "@agari/core/types";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { BasketPicker } from "./BasketPicker";
import { DESK } from "./copy";
import { CreateStep, FirstSteps } from "./CreateStep";
import { draftFromMandate, draftKey, draftStorageKey, draftToMandate, draftTotalBps, initialDraft, type StudioDraft } from "./draft";
import { LimitsForm } from "./LimitsForm";
import { StudioSide } from "./StudioSide";
import { READ_IDLE, TestRead, type ReadState } from "./TestRead";
import type { StudioActions } from "./useDeskWrites";
import type { DeskView } from "./view";
import "./desk.css";

const S = DESK.studio;

export interface DeskStudioProps {
  owner: Address | null;
  view: DeskView | null;
  writes: StudioActions;
  /** `?basket=AILABS` from /baskets, or a preset id. */
  initialBasket: string | null;
  editing: boolean;
  onConnect: () => void;
  zone: string | null;
  nowSec: number;
  /** Fixtures open on a step; live use always starts at 01. */
  initialStep?: number;
  initialRead?: ReadState;
}

/**
 * The studio (plan §5.4): Agari's four-step frame (`CreatorStudio`) around the desk's meaning: 01 the basket, 02 how
 * strict and the limits, 03 the test read, 04 create. The side card follows every edit. Drafting is open to anyone;
 * the read and the creation need the wallet's one signature. The draft is kept in this browser per owner.
 */
export function DeskStudio({ owner, view, writes, initialBasket, editing, onConnect, zone, nowSec, initialStep = 1, initialRead = READ_IDLE }: DeskStudioProps) {
  const [draft, setDraftState] = useState<StudioDraft>(() => (editing && view?.mandate ? draftFromMandate(view.mandate) : initialDraft(initialBasket)));
  const [step, setStep] = useState(initialStep);
  const [problem, setProblem] = useState<string | null>(null);
  const [read, setRead] = useState<ReadState>(initialRead);
  const [created, setCreated] = useState(false);
  const storageKey = draftStorageKey(owner);

  // The saved draft returns after mount, so the server and the first client render agree; an edit starts from the mandate.
  useEffect(() => {
    if (editing || initialBasket) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setDraftState({ ...initialDraft(null), ...(JSON.parse(raw) as Partial<StudioDraft>) });
    } catch {
      // storage unavailable: the default draft stands
    }
  }, [storageKey, editing, initialBasket]);
  const setDraft = (update: (d: StudioDraft) => StudioDraft) =>
    setDraftState((d) => {
      const next = update(d);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // storage unavailable
      }
      return next;
    });

  const result = useMemo(() => draftToMandate(draft), [draft]);
  const mandate = result.ok ? result.mandate : null;
  const readStanding = read.status === "done" ? (read.key === draftKey(draft) ? "done" : "stale") : "none";

  const advance = () => {
    if (step === 1 && draftTotalBps(draft) !== 10_000) return setProblem(S.basket.mustAddUp);
    if (step === 2 && !result.ok) return setProblem(`${result.problems.join(". ")}.`);
    setProblem(null);
    setStep((s) => Math.min(4, s + 1));
  };

  if (created) return <FirstSteps isLive={view?.isLive ?? false} onMoney={null} />;
  const head = editing && view?.exists ? S.edit : { kicker: S.kicker, title: S.title, body: S.body };

  return (
    <section className="dk-page container" aria-label={S.title}>
      <header className="dk-hero">
        <span className="dk-eyebrow">{DESK.eyebrow.studio}</span>
        <p className="type-caption text-accent">{head.kicker}</p>
        <h1 className="dk-title">{head.title}</h1>
        <p className="type-body text-ink-secondary">{head.body}</p>
      </header>
      <ol className="dk-steps" aria-label={S.stepsAria}>
        {S.steps.map((label, index) => (
          <li key={label} aria-current={step === index + 1 ? "step" : undefined}>
            <button type="button" disabled={index + 1 >= step} onClick={() => { setProblem(null); setStep(index + 1); }}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>
      <div className="dk-studio">
        <div className="flex min-w-0 flex-col gap-5">
          <h2 className="dk-holding-name">{S.steps[step - 1]}</h2>
          {step === 1 && <BasketPicker draft={draft} setDraft={setDraft} />}
          {step === 2 && <LimitsForm draft={draft} setDraft={setDraft} mandate={mandate} />}
          {step === 3 && <TestRead draft={draft} setDraft={setDraft} mandate={mandate} owner={owner} view={view} writes={writes} read={read} setRead={setRead} onConnect={onConnect} zone={zone} nowSec={nowSec} />}
          {step === 4 && <CreateStep draft={draft} mandate={mandate} owner={owner} view={view} writes={writes} editing={editing} problems={result.ok ? [] : result.problems} onConnect={onConnect} onCreated={() => setCreated(true)} zone={zone} nowSec={nowSec} />}
          {problem && <p className="type-caption dk-warn" role="alert">{problem}</p>}
          <div className="dk-studio-actions">
            {step > 1 ? <button type="button" className="dk-control" onClick={() => { setProblem(null); setStep((s) => s - 1); }}>{S.back}</button> : <span />}
            {step < 4 && (
              <button type="button" className={cn("dk-control")} data-tone="primary" onClick={advance}>
                {step === 3 && readStanding !== "done" ? S.nextWithoutRead : S.next}
              </button>
            )}
          </div>
        </div>
        <StudioSide draft={draft} mandate={mandate} read={readStanding} />
      </div>
    </section>
  );
}
