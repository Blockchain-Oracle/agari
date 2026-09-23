"use client";

import type { Address } from "@agari/core/types";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { StepProgress } from "@/components/ui/desk-kit";
import { BasketPicker } from "./BasketPicker";
import { DESK } from "./copy";
import { CreateStep, FirstSteps } from "./CreateStep";
import { draftFromMandate, draftKey, draftStorageKey, draftToMandate, draftTotalBps, initialDraft, type StudioDraft } from "./draft";
import { LimitsForm } from "./LimitsForm";
import { StudioSide } from "./StudioSide";
import { READ_IDLE, TestRead, type ReadState } from "./TestRead";
import type { StudioActions } from "./useDeskWrites";
import type { DeskView } from "./view";
import { STUDIO } from "./studio/copy-studio";
import "./desk.css";
import "./studio/studio.css";

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
  const reduce = useReducedMotion();
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
      <StepProgress steps={STUDIO.steps} current={step} onPick={(n) => { setProblem(null); setStep(n); }} label={S.stepsAria} />
      <div className="dk-studio st-studio">
        <div className="flex min-w-0 flex-col gap-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} className="flex min-w-0 flex-col gap-6" initial={reduce ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, x: -16 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
              <h2 className="st-step-title"><span>{String(step).padStart(2, "0")}</span>{S.steps[step - 1]}</h2>
              {step === 1 && <BasketPicker draft={draft} setDraft={setDraft} />}
              {step === 2 && <LimitsForm draft={draft} setDraft={setDraft} mandate={mandate} />}
              {step === 3 && <TestRead draft={draft} setDraft={setDraft} mandate={mandate} owner={owner} view={view} writes={writes} read={read} setRead={setRead} onConnect={onConnect} zone={zone} nowSec={nowSec} />}
              {step === 4 && <CreateStep draft={draft} mandate={mandate} owner={owner} view={view} writes={writes} editing={editing} problems={result.ok ? [] : result.problems} onConnect={onConnect} onCreated={() => setCreated(true)} zone={zone} nowSec={nowSec} />}
            </motion.div>
          </AnimatePresence>
          {problem && <p className="type-caption dk-warn" role="alert">{problem}</p>}
          <div className="st-actions">
            {step > 1 ? (
              <button type="button" className="st-btn" onClick={() => { setProblem(null); setStep((s) => s - 1); }}>
                <ArrowLeft className="size-4" aria-hidden /> {STUDIO.nav.back}
              </button>
            ) : <span />}
            {step < 4 && (
              <button type="button" className="st-btn" data-tone="primary" onClick={advance}>
                {step === 3 && readStanding !== "done" ? STUDIO.nav.nextWithoutRead : STUDIO.nav.next} <ArrowRight className="size-4" aria-hidden />
              </button>
            )}
          </div>
        </div>
        <StudioSide draft={draft} mandate={mandate} read={readStanding} />
      </div>
    </section>
  );
}
