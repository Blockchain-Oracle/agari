"use client";

import { nameOf } from "@agari/core/desk";
import type { ReactNode } from "react";
import { CountdownRing } from "@/components/data";
import { DESK } from "./copy";
import { ago, clock, nextTopOfHour, pct, pctSigned, span, stamp, usd, usdSigned } from "./format";
import type { ApprovalWire } from "./protocol";
import type { DeskActions } from "./useDeskWrites";
import type { DeskView } from "./view";

export function Panel({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="dk-panel" aria-label={title}>
      <header className="dk-panel-head">
        <h2 className="dk-panel-title">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

function ApprovalCard({ a, view, actions, zone, nowSec }: { a: ApprovalWire; view: DeskView; actions: DeskActions | null; zone: string | null; nowSec: number }) {
  const N = DESK.page.needsYou;
  const expired = a.status !== "open" || a.expiresAtSec <= nowSec;
  const busy = actions?.state.busy === "approval";
  return (
    <div className="dk-card" data-tone={expired ? undefined : "good"}>
      <p className="type-body text-ink">{a.summary}</p>
      {a.symbol && a.amountIn && a.expectedOut && <p className="dk-mono text-ink-secondary">{N.trade(a.side ?? "buy", a.amountIn, a.expectedOut, nameOf(a.symbol))}</p>}
      <p className="type-caption text-ink-muted">
        {N.asking[a.reason]}
        {a.confidencePercent !== null ? ` · ${N.confidence(a.confidencePercent)}` : ""}
        {a.costBps !== null ? ` · ${N.cost(pct(a.costBps))}` : ""}
      </p>
      {a.turnedDown && <p className="type-caption text-ink-secondary">{N.turnedDown(a.turnedDown)}</p>}
      {expired ? (
        <p className="type-caption text-ink-muted">{N.expired}</p>
      ) : (
        <div className="dk-card-actions">
          {view.isOwner && actions && (
            <>
              <button type="button" className="dk-control" data-tone="primary" disabled={busy} onClick={() => void actions.answer(a, "approve")}>{busy ? N.approving : N.approve}</button>
              <button type="button" className="dk-control" disabled={busy} onClick={() => void actions.answer(a, "decline")}>{N.decline}</button>
            </>
          )}
          <span className="type-caption text-ink-muted">{N.expires(`${stamp(a.expiresAtSec, zone)} · ${span(a.expiresAtSec - nowSec)}`)}</span>
        </div>
      )}
    </div>
  );
}

/** Item 1 (plan §5.7): approvals waiting, the state warnings, otherwise "Nothing needs you." */
export function NeedsYou({ view, actions, zone, nowSec }: { view: DeskView; actions: DeskActions | null; zone: string | null; nowSec: number }) {
  const N = DESK.page.needsYou;
  const warnings: string[] = [];
  if (view.state === "paused_by_owner") warnings.push(N.paused);
  if (view.state === "stopped_by_loss_limit") warnings.push(N.lossStop);
  if (view.state === "closed") warnings.push(N.closed);
  if (view.nextCheck.late && view.nextCheck.lastAtSec !== null) warnings.push(N.late(ago(view.nextCheck.lastAtSec, nowSec)));
  if (view.wire.desk?.stateReason && view.state === "needs_attention") warnings.push(view.wire.desk.stateReason);
  const quiet = warnings.length === 0 && view.approvals.open.length === 0 && view.approvals.expired.length === 0;
  return (
    <Panel title={N.title}>
      {warnings.map((w) => (
        <p key={w} className="type-body dk-warn">{w}</p>
      ))}
      {quiet && <p className="type-body text-ink-secondary">{N.nothing}</p>}
      {[...view.approvals.open, ...view.approvals.expired].map((a) => (
        <ApprovalCard key={a.id} a={a} view={view} actions={actions} zone={zone} nowSec={nowSec} />
      ))}
    </Panel>
  );
}

/** Item 2: total value, since your money went in, and the Timing line graded a day later (never a win stamp). */
export function Plate({ view, nowSec }: { view: DeskView; nowSec: number }) {
  const P = DESK.page.plate;
  const { plate } = view;
  return (
    <Panel title={P.title}>
      {plate.totalE6 === null ? (
        <>
          <p className="type-body text-ink-secondary">{P.notYet}</p>
          {!view.isLive && <p className="type-caption text-ink-muted">{P.practiceCash(usd(plate.cashE6))}</p>}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="type-caption text-ink-muted">{P.total}</div>
              <div className="dk-plate-figure">{usd(plate.totalE6)}</div>
            </div>
            <div className="dk-plate-side">
              {plate.sinceE6 !== null && (
                <div>
                  <span className="type-caption text-ink-muted">{P.since}</span>
                  <span className="dk-plate-value">{usdSigned(plate.sinceE6)}</span>
                </div>
              )}
              <div>
                <span className="type-caption text-ink-muted">{P.timing}</span>
                <span className="dk-plate-value">{plate.timing.graded === 0 ? "—" : pctSigned(plate.timing.bps)}</span>
              </div>
            </div>
          </div>
          <p className="type-caption text-ink-muted">{plate.timing.graded === 0 ? P.timingNone : `${P.timingValue(pctSigned(plate.timing.bps), plate.timing.graded)}. ${P.timingNote}`}</p>
          {plate.valuedAtSec !== null && <p className="type-caption text-ink-muted">{P.valued(ago(plate.valuedAtSec, nowSec))}</p>}
        </>
      )}
    </Panel>
  );
}

/** Item 3: the hour's calm ring, the mode chip and its one-line note, practice progress and the locked Go live. */
export function NextCheck({ view, zone, nowSec, onGoLive }: { view: DeskView; zone: string | null; nowSec: number; onGoLive: (() => void) | null }) {
  const C = DESK.page.nextCheck;
  const atSec = nextTopOfHour(nowSec);
  const fraction = Math.max(0, Math.min(1, (atSec - nowSec) / 3_600));
  const { practice } = view;
  const active = view.state === "active" || view.state === "practice";
  return (
    <Panel title={C.title} aside={<span className="dk-chip" data-mode={view.mode}>{DESK.modes[view.mode]}</span>}>
      <div className="dk-check">
        <CountdownRing fraction={fraction} className="dk-ring">
          <span className="dk-ring-text">{span(atSec - nowSec)}</span>
        </CountdownRing>
        <div className="flex flex-col gap-1">
          <p className={active ? "type-body text-ink" : "type-body dk-warn"}>{active ? C.lead(clock(atSec, zone), span(atSec - nowSec)) : view.stateText}</p>
          <p className="type-caption text-ink-secondary">{view.nextCheck.lastAtSec === null ? C.noCheck : C.lastCheck(ago(view.nextCheck.lastAtSec, nowSec))}</p>
          <p className="type-caption text-ink-muted">{DESK.modeNote[view.mode]}</p>
        </div>
      </div>
      <p className="type-caption text-ink-muted">{C.also}</p>
      {!view.isLive && view.exists && (
        <div className="flex flex-col gap-2">
          <div className="dk-bar" aria-hidden>
            <span className="dk-bar-fill" style={{ width: `${Math.min(100, (practice.done / practice.needed) * 100)}%` }} />
          </div>
          <p className="type-caption text-ink-secondary">
            {C.progress(practice.done, practice.needed)} · {practice.opened ? C.opened : C.notOpened}
            {practice.ready ? ` · ${C.goLiveReady}` : ""}
          </p>
          {view.isOwner && (
            <div className="dk-card-actions">
              <button type="button" className="dk-control" data-tone={practice.ready ? "primary" : undefined} data-locked={practice.ready ? undefined : ""} disabled={!practice.ready || !onGoLive} onClick={onGoLive ?? undefined} title={practice.ready ? undefined : C.goLiveLocked(practice.needed)}>
                {C.goLive}
              </button>
              {!practice.ready && <span className="type-caption text-ink-muted">{C.goLiveLocked(practice.needed)}</span>}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
