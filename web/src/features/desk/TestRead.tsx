"use client";

import { deskRecordSchema, type DeskMandate } from "@agari/core/desk";
import type { Address } from "@agari/core/types";
import { Check, CircleDashed, LoaderCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Timeline, TimelineNode } from "@/components/ui/desk-kit";
import { DESK } from "./copy";
import { draftKey, practiceCashE6, readBack, type StudioDraft } from "./draft";
import { clock } from "./format";
import { Outcome } from "./Outcome";
import { useDecision, useInvalidateDesk } from "./useDesk";
import type { StudioActions } from "./useDeskWrites";
import type { DeskView } from "./view";
import { STUDIO } from "./studio/copy-studio";

const R = DESK.studio.read;

/**
 * The read as an agent's activity stream (S22): the five things one check does. Signing lights the first; while the
 * desk works the rest shimmer together (the runner reports only when it has finished); on arrival every one is done.
 */
function ReadStream({ status }: { status: ReadState["status"] }) {
  const T = STUDIO.read;
  const working = status === "signing" || status === "waiting";
  return (
    <section className="st-stream" data-state={status} aria-live="polite">
      <div className="st-stream-head">
        <Sparkles className="size-4" aria-hidden />
        <span className={working ? "st-shimmer" : undefined}>{status === "done" ? T.done : working ? T.working : T.streamTitle}</span>
      </div>
      <Timeline label={T.streamTitle}>
        {T.steps.map((line, i) => {
          const done = status === "done" || (status === "waiting" && i === 0);
          const active = (status === "signing" && i === 0) || (status === "waiting" && i > 0);
          return (
            <TimelineNode key={line} index={i} tone={done ? "acted" : "neutral"} icon={done ? <Check strokeWidth={2.75} /> : active ? <LoaderCircle className="st-spin" /> : <CircleDashed />}>
              <p className="st-stream-line" data-state={done ? "done" : active ? "active" : "idle"}>{line}</p>
            </TimelineNode>
          );
        })}
      </Timeline>
    </section>
  );
}
/** While the first check runs, the desk view is refetched this often, for at most this long. */
const POLL_MS = 5_000;
const POLL_FOR_SEC = 180;

export interface ReadState {
  status: "idle" | "signing" | "waiting" | "done" | "failed";
  key: string | null;
  requestedAtSec: number | null;
  throttledUntilSec: number | null;
  problem: string | null;
}
export const READ_IDLE: ReadState = { status: "idle", key: null, requestedAtSec: null, throttledUntilSec: null, problem: null };

interface TestReadProps {
  draft: StudioDraft;
  setDraft: (update: (d: StudioDraft) => StudioDraft) => void;
  mandate: DeskMandate | null;
  owner: Address | null;
  view: DeskView | null;
  writes: StudioActions;
  read: ReadState;
  setRead: (read: ReadState) => void;
  onConnect: () => void;
  zone: string | null;
  nowSec: number;
}

/**
 * Step 03 (plan §5.4): "Read my basket now". Signing the mandate starts the practice desk (or applies a new version)
 * and asks it to check now; the first decision appears as a card when the runner has written it, then the read-back
 * "Here is how I understood you", with the desk's own warnings as its one question when it had one.
 */
export function TestRead({ draft, setDraft, mandate, owner, view, writes, read, setRead, onConnect, zone, nowSec }: TestReadProps) {
  const invalidate = useInvalidateDesk();
  const exists = view?.exists ?? false;
  const latest = view?.wire.latest ?? null;
  const arrived = read.status === "waiting" && latest !== null && read.requestedAtSec !== null && latest.decidedAtSec >= read.requestedAtSec - 30;
  useEffect(() => {
    if (read.status !== "waiting" || arrived) return;
    if (read.requestedAtSec !== null && nowSec - read.requestedAtSec > POLL_FOR_SEC) return;
    const id = setInterval(() => void invalidate(), POLL_MS);
    return () => clearInterval(id);
  }, [read.status, read.requestedAtSec, arrived, nowSec, invalidate]);
  useEffect(() => {
    if (arrived) setRead({ ...read, status: "done" });
  }, [arrived, read, setRead]);

  const run = async () => {
    if (!mandate) return;
    setRead({ ...READ_IDLE, status: "signing", key: draftKey(draft) });
    const result = await writes.signMandate({ mandate, version: (view?.wire.mandate?.version ?? 0) + 1, trigger: "test_read", ...(exists ? {} : { practiceCashE6: practiceCashE6(draft) }) });
    if (!result.ok) return setRead({ ...READ_IDLE, status: "failed", problem: result.reason });
    const throttled = typeof result.body.throttledUntilSec === "number" ? result.body.throttledUntilSec : null;
    setRead({ status: "waiting", key: draftKey(draft), requestedAtSec: Math.floor(Date.now() / 1000), throttledUntilSec: throttled, problem: null });
  };

  const deskKey = view?.wire.desk?.id ?? null;
  const decision = useDecision(read.status === "done" && latest ? deskKey : null, latest?.seq ?? null, owner);
  const body = decision?.ok ? deskRecordSchema.safeParse(decision.value.record.body) : null;
  const warnings = body?.success ? (body.data.timing?.decision?.warnings ?? []) : [];
  const stale = read.key !== null && read.key !== draftKey(draft);

  return (
    <div className="flex flex-col gap-5">
      <p className="type-body text-ink-secondary">{R.body}</p>
      <ReadStream status={read.status} />
      {exists && <p className="type-caption text-ink-muted">{R.exists}</p>}
      {!exists && (
        <label className="st-block">
          <span className="st-label">{R.practiceCash}</span>
          <span className="st-money"><span aria-hidden>$</span><input className="dk-input" inputMode="decimal" value={draft.practiceCash} onChange={(e) => setDraft((d) => ({ ...d, practiceCash: e.target.value }))} aria-label={R.practiceCash} /></span>
          <span className="st-hint">{R.practiceCashNote}</span>
        </label>
      )}
      {!owner ? (
        <div className="dk-card-actions">
          <p className="type-caption text-ink-secondary">{R.connect}</p>
          <button type="button" className="st-btn" data-tone="primary" onClick={onConnect}>Connect</button>
        </div>
      ) : (
        <div className="dk-card-actions">
          <button type="button" className="st-btn" data-tone="primary" onClick={() => void run()} disabled={!mandate || read.status === "signing" || (read.status === "waiting" && !stale)}>
            {read.status === "signing" ? R.signing : read.status === "done" || stale ? R.again : R.run}
          </button>
          {read.status === "waiting" && <span className="type-caption text-ink-secondary">{read.throttledUntilSec ? R.throttled(clock(read.throttledUntilSec, zone)) : R.waiting}</span>}
          {read.status === "failed" && <span className="type-caption dk-warn">{read.problem ?? R.failed}</span>}
        </div>
      )}
      {read.status === "done" && latest && (
        <div className="dk-card st-first">
          <span className="dk-panel-title">{R.first}</span>
          <div className="dk-entry-head">
            <Outcome outcome={latest.outcome} practice={latest.mode === "practice"} />
            {deskKey && <Link href={`/desk/${deskKey}/decision/${latest.seq}`} className="dk-link type-caption">#{latest.seq} →</Link>}
          </div>
          <p className="type-body text-ink">{latest.summary}</p>
        </div>
      )}
      {mandate && (read.status === "done" || read.status === "waiting") && (
        <div className="dk-card">
          <span className="dk-panel-title">{R.heard}</span>
          {readBack(mandate).map((line) => (
            <p key={line} className="type-body text-ink-secondary">{line}</p>
          ))}
          {warnings.length > 0 && (
            <>
              <span className="dk-panel-title">{R.question}</span>
              {warnings.map((w) => (
                <p key={w} className="type-body text-ink">{w}</p>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
