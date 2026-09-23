"use client";

import { nameOf } from "@agari/core/desk";
import { TICKERS, type PreIpoSymbol } from "@agari/core/market";
import { ArrowRight, Ban, Check, CircleDashed, Hand, OctagonAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Donut, EmptyState, LogoStack, type NodeTone, type Slice } from "@/components/ui/desk-kit";
import { TONE } from "../activity/ActivityTimeline";
import { namesIn } from "../activity/activity-model";
import { DESK } from "../copy";
import { RECORD } from "../copy-record";
import { NeedsYou, Panel } from "../DeskPanels";
import { ago, pct, stamp } from "../format";
import type { DeskActions } from "../useDeskWrites";
import type { DeskView } from "../view";
import { COCKPIT } from "./copy-cockpit";
import { LimitGauges } from "./LimitGauges";

const O = COCKPIT.overview;
const CASH_COLOR = "var(--color-ink-muted)";
const ICON: Record<NodeTone, ReactNode> = { acted: <Check strokeWidth={2.75} />, declined: <Ban />, quiet: <CircleDashed />, asked: <Hand />, stopped: <OctagonAlert />, error: <OctagonAlert />, neutral: <CircleDashed /> };

export const brandColor = (symbol: string): string => TICKERS[symbol as PreIpoSymbol]?.brand.hex ?? "var(--color-ink-secondary)";

/** The newest record as a hero card: its verdict and icon, the companies, the reason in full, and the way in. */
function LatestDecision({ view, base, nowSec, zone }: { view: DeskView; base: string; nowSec: number; zone: string | null }) {
  const r = view.wire.latest;
  if (!r) return <Panel title={O.latest}><EmptyState icon={<CircleDashed />} title={O.noneYet} body={DESK.page.record.empty} /></Panel>;
  const tone = TONE[r.outcome];
  const names = namesIn(r.summary);
  return (
    <Link href={`${base}/decision/${r.seq}`} className="cp-card cp-latest" data-tone={tone} aria-label={`${O.latest}: ${r.summary}`}>
      <div className="cp-latest-head">
        <span className="dk-panel-title">{O.latest}</span>
        <span className="act-meta">#{r.seq} · {ago(r.decidedAtSec, nowSec)}</span>
      </div>
      <div className="cp-latest-body">
        <span className="cp-latest-icon" data-tone={tone} aria-hidden>{ICON[tone]}</span>
        <div className="cp-latest-text">
          <span className="act-verdict" data-tone={tone}>{RECORD.outcome[r.outcome]}{r.mode === "practice" ? ` · ${RECORD.list.practiceTag}` : ""}</span>
          <p className="cp-latest-summary">{r.summary}</p>
          <span className="cp-latest-foot">
            {names.length > 0 && <LogoStack symbols={names} size="sm" />}
            <span className="type-caption text-ink-muted">{stamp(r.decidedAtSec, zone)}</span>
            <span className="cp-latest-open">{O.open} <ArrowRight /></span>
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Now against target as two rings (outer: held now, inner: the mandate) and a legend with both figures per name. */
function Allocation({ view }: { view: DeskView }) {
  const targets = view.mandate?.targets;
  const nowSlices: Slice[] = view.holdings.map((h) => ({ id: h.symbol, label: h.name, value: h.weightBps, color: brandColor(h.symbol) }));
  const heldBps = nowSlices.reduce((s, x) => s + x.value, 0);
  const valued = view.plate.totalE6 !== null && heldBps > 0;
  const cashNowBps = valued ? Math.max(0, 10_000 - heldBps) : 10_000;
  const now: Slice[] = [...(valued ? nowSlices : []), { id: "cash", label: O.cash, value: cashNowBps, color: CASH_COLOR }];
  const target: Slice[] = [...(targets?.tokens.map((t) => ({ id: t.symbol, label: nameOf(t.symbol), value: t.weightBps, color: brandColor(t.symbol) })) ?? []), { id: "cash", label: O.cash, value: targets?.cashBps ?? 0, color: CASH_COLOR }];
  const rows = target.map((t) => ({ ...t, now: now.find((n) => n.id === t.id)?.value ?? 0 }));
  return (
    <Panel title={O.allocation} className="cp-alloc">
      <div className="cp-alloc-body">
        <Donut slices={now} size={176} thickness={18} label={O.ringsAria}>
          <Donut slices={target} size={124} thickness={8} label={O.target}>
            <span className="cp-alloc-center">
              <span className="cp-stat-label">{O.now}</span>
              <span className="cp-alloc-center-sub">{O.target}</span>
            </span>
          </Donut>
        </Donut>
        <ul className="cp-legend">
          <li className="cp-legend-head"><span /><span>{O.now}</span><span>{O.target}</span></li>
          {rows.map((r) => (
            <li key={r.id}>
              <span className="cp-legend-name"><span className="cp-legend-swatch" style={{ background: r.color }} />{r.label}</span>
              <span className="cp-legend-fig">{pct(r.now)}</span>
              <span className="cp-legend-fig text-ink-muted">{pct(r.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

export function OverviewTab({ view, actions, base, zone, nowSec }: { view: DeskView; actions: DeskActions | null; base: string; zone: string | null; nowSec: number }) {
  return (
    <div className="cp-overview">
      <div className="cp-col">
        <NeedsYou view={view} actions={actions} zone={zone} nowSec={nowSec} />
        <LatestDecision view={view} base={base} nowSec={nowSec} zone={zone} />
      </div>
      <div className="cp-col">
        <Allocation view={view} />
        <LimitGauges view={view} />
      </div>
    </div>
  );
}
