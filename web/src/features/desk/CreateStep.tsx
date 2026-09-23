"use client";

import type { DeskMandate } from "@agari/core/desk";
import type { Address } from "@agari/core/types";
import { BellRing, CircleCheckBig, FlaskConical, Rocket, Wallet } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { RadioCards } from "@/components/ui/desk-kit";
import { notificationState, requestNotificationPermission } from "@/features/alerts";
import { DESK } from "./copy";
import { GO_LIVE } from "./copy-controls";
import { practiceCashE6, type StudioDraft } from "./draft";
import { GoLive } from "./GoLive";
import { GO_LIVE_CHECKS } from "./protocol";
import type { StudioActions } from "./useDeskWrites";
import type { DeskView } from "./view";
import { STUDIO } from "./studio/copy-studio";
import { Receipt } from "./studio/Receipt";

const C = DESK.studio.create;

interface CreateStepProps {
  draft: StudioDraft;
  mandate: DeskMandate | null;
  owner: Address | null;
  view: DeskView | null;
  writes: StudioActions;
  editing: boolean;
  problems: string[];
  onConnect: () => void;
  onCreated: () => void;
  zone: string | null;
  nowSec: number;
}

/**
 * Step 04 (plan §5.4): Practice needs no transaction, one signature and the desk exists; Live is Go live's four
 * mainnet steps, offered once the practice rule is met. Editing an existing desk signs a new mandate version.
 */
export function CreateStep({ draft, mandate, owner, view, writes, editing, problems, onConnect, onCreated, zone, nowSec }: CreateStepProps) {
  const [choice, setChoice] = useState<"practice" | "live">("practice");
  const [problem, setProblem] = useState<string | null>(null);
  const busy = writes.state.busy === "mandate";
  const exists = view?.exists ?? false;
  const version = (view?.wire.mandate?.version ?? 0) + 1;

  const sign = async (trigger: "create" | "edit") => {
    if (!mandate) return;
    setProblem(null);
    const result = await writes.signMandate({ mandate, version, trigger, ...(exists ? {} : { practiceCashE6: practiceCashE6(draft) }) });
    if (!result.ok) return setProblem(result.reason);
    onCreated();
  };

  if (!owner) {
    return (
      <div className="dk-card-actions">
        <p className="type-caption text-ink-secondary">{C.connect}</p>
        <button type="button" className="st-btn" data-tone="primary" onClick={onConnect}>Connect</button>
      </div>
    );
  }
  if (problems.length > 0) {
    return (
      <div className="dk-card">
        <span className="dk-panel-title">{C.problems}</span>
        {problems.map((p) => (
          <p key={p} className="type-body dk-warn">{p}</p>
        ))}
      </div>
    );
  }
  if (editing && exists) {
    return (
      <div className="flex flex-col gap-4">
        <p className="type-body text-ink-secondary">{DESK.studio.edit.body}</p>
        <div className="dk-card-actions">
          <button type="button" className="st-btn" data-tone="primary" onClick={() => void sign("edit")} disabled={busy || !mandate}>{busy ? DESK.studio.read.signing : C.apply}</button>
          {problem && <span className="type-caption dk-warn">{problem}</span>}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {mandate && <Receipt draft={draft} mandate={mandate} />}
      <RadioCards
        value={choice}
        onChange={setChoice}
        label={STUDIO.receipt.modeAria}
        className="st-modes"
        items={[
          { value: "practice", media: <span className="st-icon-tile" data-level="careful"><FlaskConical className="size-5" /></span>, title: C.practice.title, body: C.practice.body },
          { value: "live", media: <span className="st-icon-tile" data-level="loose"><Rocket className="size-5" /></span>, title: C.live.title, body: C.live.body },
        ]}
      />
      {choice === "practice" ? (
        exists ? (
          <div className="dk-card-actions">
            <p className="type-body text-ink">{C.practice.done}</p>
            <Link href="/desk" className="st-btn" data-tone="primary">{DESK.studio.firstSteps.open}</Link>
          </div>
        ) : (
          <div className="dk-card-actions">
            <button type="button" className="st-btn st-btn-lg" data-tone="primary" onClick={() => void sign("create")} disabled={busy || !mandate}>{busy ? DESK.studio.read.signing : C.practice.button}</button>
            <span className="type-caption text-ink-muted">{DESK.network.practice}</span>
            {problem && <span className="type-caption dk-warn">{problem}</span>}
          </div>
        )
      ) : view && exists && view.practice.ready ? (
        <GoLive view={view} actions={writes} liveMode={draft.liveMode} zone={zone} nowSec={nowSec} />
      ) : (
        <p className="type-body text-ink-secondary">{C.live.needsPractice(GO_LIVE_CHECKS)}</p>
      )}
    </div>
  );
}

/** After creation (plan §5.4 "First steps"): a check that lands, then money in, the Go live rule, notifications. */
export function FirstSteps({ isLive, onMoney }: { isLive: boolean; onMoney: (() => void) | null }) {
  const F = DESK.studio.firstSteps;
  const reduce = useReducedMotion();
  const [notif, setNotif] = useState(() => notificationState());
  const card = (i: number) => ({ initial: reduce ? false : { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay: reduce ? 0 : 0.25 + i * 0.08, duration: 0.3 } }) as const;
  return (
    <section className="dk-page container st-created" aria-live="polite">
      <motion.span className="st-created-badge" initial={reduce ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 320, damping: 18 }} aria-hidden>
        <CircleCheckBig className="size-9" />
      </motion.span>
      <div className="st-created-head">
        <p className="dk-eyebrow" data-live={isLive ? "" : undefined}>{F.kicker}</p>
        <h2 className="dk-title">{F.title}</h2>
        <p className="type-body text-ink-secondary">{F.body}</p>
      </div>
      <h3 className="st-label">{F.steps}</h3>
      <div className="st-first-grid">
        <motion.section className="st-first-card" {...card(0)}>
          <span className="st-icon-tile" data-level="careful"><Wallet className="size-5" /></span>
          <span className="st-first-title">{F.money.title}</span>
          <p className="type-caption text-ink-secondary">{isLive ? F.money.body : GO_LIVE.fees}</p>
          {isLive && onMoney && <button type="button" className="st-btn" onClick={onMoney}>{F.money.title}</button>}
        </motion.section>
        <motion.section className="st-first-card" {...card(1)}>
          <span className="st-icon-tile" data-level="balanced"><Rocket className="size-5" /></span>
          <span className="st-first-title">{F.goLive.title}</span>
          <p className="type-caption text-ink-secondary">{F.goLive.body(GO_LIVE_CHECKS)}</p>
        </motion.section>
        <motion.section className="st-first-card" {...card(2)}>
          <span className="st-icon-tile" data-level="loose"><BellRing className="size-5" /></span>
          <span className="st-first-title">{F.notify.title}</span>
          <p className="type-caption text-ink-secondary">{F.notify.body}</p>
          {notif === "granted" ? (
            <p className="type-caption text-ink">{F.notify.on}</p>
          ) : notif === "denied" ? (
            <p className="type-caption dk-warn">{F.notify.denied}</p>
          ) : (
            <button type="button" className="st-btn" onClick={() => void requestNotificationPermission().then(() => setNotif(notificationState()))}>{F.notify.turnOn}</button>
          )}
        </motion.section>
      </div>
      <Link href="/desk" className="st-btn st-btn-lg self-start" data-tone="primary">{F.open}</Link>
    </section>
  );
}
