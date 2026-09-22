"use client";

import type { DeskMandate } from "@agari/core/desk";
import type { Address } from "@agari/core/types";
import Link from "next/link";
import { useState } from "react";
import { notificationState, requestNotificationPermission } from "@/features/alerts";
import { DESK } from "./copy";
import { GO_LIVE } from "./copy-controls";
import { practiceCashE6, type StudioDraft } from "./draft";
import { GoLive } from "./GoLive";
import { GO_LIVE_CHECKS } from "./protocol";
import type { StudioActions } from "./useDeskWrites";
import type { DeskView } from "./view";

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
        <button type="button" className="dk-control" data-tone="primary" onClick={onConnect}>Connect</button>
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
          <button type="button" className="dk-control" data-tone="primary" onClick={() => void sign("edit")} disabled={busy || !mandate}>{busy ? DESK.studio.read.signing : C.apply}</button>
          {problem && <span className="type-caption dk-warn">{problem}</span>}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="dk-choices" role="radiogroup" aria-label={C.title}>
        <button type="button" role="radio" aria-checked={choice === "practice"} className="dk-choice" onClick={() => setChoice("practice")}>
          <span className="dk-choice-title">{C.practice.title}</span>
          <span className="dk-choice-body">{C.practice.body}</span>
        </button>
        <button type="button" role="radio" aria-checked={choice === "live"} className="dk-choice" onClick={() => setChoice("live")}>
          <span className="dk-choice-title">{C.live.title}</span>
          <span className="dk-choice-body">{C.live.body}</span>
        </button>
      </div>
      {choice === "practice" ? (
        exists ? (
          <div className="dk-card-actions">
            <p className="type-body text-ink">{C.practice.done}</p>
            <Link href="/desk" className="dk-control" data-tone="primary">{DESK.studio.firstSteps.open}</Link>
          </div>
        ) : (
          <div className="dk-card-actions">
            <button type="button" className="dk-control" data-tone="primary" onClick={() => void sign("create")} disabled={busy || !mandate}>{busy ? DESK.studio.read.signing : C.practice.button}</button>
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

/** After creation (plan §5.4 "First steps"): put money in, the Go live rule, notifications. Each can wait. */
export function FirstSteps({ isLive, onMoney }: { isLive: boolean; onMoney: (() => void) | null }) {
  const F = DESK.studio.firstSteps;
  const [notif, setNotif] = useState(() => notificationState());
  return (
    <section className="flex flex-col gap-5" aria-live="polite">
      <div>
        <p className="dk-eyebrow" data-live={isLive ? "" : undefined}>{F.kicker}</p>
        <h2 className="dk-title">{F.title}</h2>
        <p className="type-body text-ink-secondary">{F.body}</p>
      </div>
      <h3 className="dk-panel-title">{F.steps}</h3>
      <div className="dk-first">
        <section className="dk-panel">
          <span className="dk-panel-title">{F.money.title}</span>
          <p className="type-caption text-ink-secondary">{isLive ? F.money.body : GO_LIVE.fees}</p>
          {isLive && onMoney && <button type="button" className="dk-control" onClick={onMoney}>{DESK.studio.firstSteps.money.title} →</button>}
        </section>
        <section className="dk-panel">
          <span className="dk-panel-title">{F.goLive.title}</span>
          <p className="type-caption text-ink-secondary">{F.goLive.body(GO_LIVE_CHECKS)}</p>
        </section>
        <section className="dk-panel">
          <span className="dk-panel-title">{F.notify.title}</span>
          <p className="type-caption text-ink-secondary">{F.notify.body}</p>
          {notif === "granted" ? (
            <p className="type-caption text-ink">{F.notify.on}</p>
          ) : notif === "denied" ? (
            <p className="type-caption dk-warn">{F.notify.denied}</p>
          ) : (
            <button type="button" className="dk-control" onClick={() => void requestNotificationPermission().then(() => setNotif(notificationState()))}>{F.notify.turnOn}</button>
          )}
        </section>
      </div>
      <Link href="/desk" className="dk-control self-start" data-tone="primary">{F.open}</Link>
    </section>
  );
}
