"use client";

import { nameOf } from "@agari/core/desk";
import { Clock3, Hand, OctagonAlert } from "lucide-react";
import type { ReactNode } from "react";
import { RadialGauge } from "@/components/ui/desk-kit";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { DESK } from "./copy";
import { ago, pct, span, stamp } from "./format";
import type { ApprovalWire } from "./protocol";
import type { DeskActions } from "./useDeskWrites";
import type { DeskView } from "./view";

/** A titled card; the cockpit's tabs are built from these. */
export function Panel({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className ? `cp-card ${className}` : "cp-card"} aria-label={title}>
      <header className="dk-panel-head">
        <h2 className="dk-panel-title">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** One approval as a trade ticket: the company's mark, the trade, why it asks, the timing confidence, Approve/Decline. */
function ApprovalCard({ a, view, actions, zone, nowSec }: { a: ApprovalWire; view: DeskView; actions: DeskActions | null; zone: string | null; nowSec: number }) {
  const N = DESK.page.needsYou;
  const expired = a.status !== "open" || a.expiresAtSec <= nowSec;
  const busy = actions?.state.busy === "approval";
  return (
    <div className="cp-approval" data-expired={expired ? "" : undefined}>
      <div className="cp-approval-head">
        {a.symbol ? <AssetDisc asset={a.symbol} className="cp-approval-disc" /> : <span className="cp-approval-disc cp-icon-disc"><Hand /></span>}
        <div className="cp-approval-text">
          <p className="cp-approval-title">{a.summary}</p>
          {a.symbol && a.amountIn && a.expectedOut && <p className="dk-mono text-ink-secondary">{N.trade(a.side ?? "buy", a.amountIn, a.expectedOut, nameOf(a.symbol))}</p>}
        </div>
        {a.confidencePercent !== null && (
          <RadialGauge value={a.confidencePercent} size={52} stroke={5} tone="accent" label={N.confidence(a.confidencePercent)}>
            {a.confidencePercent}%
          </RadialGauge>
        )}
      </div>
      <p className="type-caption text-ink-muted">
        {N.asking[a.reason]}
        {a.confidencePercent !== null ? ` · ${N.confidence(a.confidencePercent)}` : ""}
        {a.costBps !== null ? ` · ${N.cost(pct(a.costBps))}` : ""}
      </p>
      {a.turnedDown && <p className="type-caption text-ink-secondary">{N.turnedDown(a.turnedDown)}</p>}
      {expired ? (
        <p className="cp-approval-expired type-caption"><Clock3 /> {N.expired}</p>
      ) : (
        <div className="cp-approval-actions">
          {view.isOwner && actions && (
            <>
              <button type="button" className="cp-action" data-tone="primary" disabled={busy} onClick={() => void actions.answer(a, "approve")}>{busy ? N.approving : N.approve}</button>
              <button type="button" className="cp-action" disabled={busy} onClick={() => void actions.answer(a, "decline")}>{N.decline}</button>
            </>
          )}
          <span className="type-caption text-ink-muted"><Clock3 className="cp-inline-icon" /> {N.expires(`${stamp(a.expiresAtSec, zone)} · ${span(a.expiresAtSec - nowSec)}`)}</span>
        </div>
      )}
    </div>
  );
}

/** Item 1 (plan §5.7): approvals waiting and the state warnings; when all is quiet, one calm line. */
export function NeedsYou({ view, actions, zone, nowSec }: { view: DeskView; actions: DeskActions | null; zone: string | null; nowSec: number }) {
  const N = DESK.page.needsYou;
  const warnings: string[] = [];
  if (view.state === "paused_by_owner") warnings.push(N.paused);
  if (view.state === "stopped_by_loss_limit") warnings.push(N.lossStop);
  if (view.state === "closed") warnings.push(N.closed);
  if (view.nextCheck.late && view.nextCheck.lastAtSec !== null) warnings.push(N.late(ago(view.nextCheck.lastAtSec, nowSec)));
  if (view.wire.desk?.stateReason && view.state === "needs_attention") warnings.push(view.wire.desk.stateReason);
  const approvals = [...view.approvals.open, ...view.approvals.expired];
  if (warnings.length === 0 && approvals.length === 0) {
    return (
      <div className="cp-quiet-line">
        <span className="cp-quiet-dot" aria-hidden />
        <span className="dk-panel-title">{N.title}</span>
        <span className="type-caption text-ink-secondary">{N.nothing}</span>
      </div>
    );
  }
  return (
    <Panel title={N.title} className="cp-needs" aside={view.approvals.open.length > 0 ? <span className="cp-count">{view.approvals.open.length}</span> : undefined}>
      {warnings.map((w) => (
        <p key={w} className="cp-warning"><OctagonAlert /> <span>{w}</span></p>
      ))}
      {approvals.map((a) => (
        <ApprovalCard key={a.id} a={a} view={view} actions={actions} zone={zone} nowSec={nowSec} />
      ))}
    </Panel>
  );
}
