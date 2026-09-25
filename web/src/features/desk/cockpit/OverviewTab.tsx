"use client";

import { nameOf } from "@agari/core/desk";
import { TICKERS, type PreIpoSymbol } from "@agari/core/market";
import { CircleDashed } from "lucide-react";
import Link from "next/link";
import { Donut, EmptyState, type Slice } from "@/components/ui/desk-kit";
import { CheckCard } from "../activity/CheckCard";
import { groupChecks } from "../activity/check-groups";
import { DESK } from "../copy";
import { NeedsYou, Panel } from "../DeskPanels";
import { pct } from "../format";
import type { DeskActions } from "../useDeskWrites";
import type { DeskView } from "../view";
import { COCKPIT } from "./copy-cockpit";
import { LimitGauges } from "./LimitGauges";

const O = COCKPIT.overview;
const CASH_COLOR = "var(--color-ink-muted)";

export const brandColor = (symbol: string): string => TICKERS[symbol as PreIpoSymbol]?.brand.hex ?? "var(--color-ink-secondary)";

/** The newest check as the activity timeline draws it: a line per company, reasons folded, and the way to the rest. */
function LatestCheck({ view, base, nowSec, zone }: { view: DeskView; base: string; nowSec: number; zone: string | null }) {
  const group = groupChecks(view.wire.recent.length > 0 ? view.wire.recent : view.wire.latest ? [view.wire.latest] : [])[0];
  if (!group) return <Panel title={O.latest}><EmptyState icon={<CircleDashed />} title={O.noneYet} body={DESK.page.record.empty} /></Panel>;
  return (
    <Panel title={O.latest} aside={<Link href={`${base}/record`} className="dk-link type-caption">{COCKPIT.activity.whole}</Link>}>
      <CheckCard group={group} base={base} nowSec={nowSec} zone={zone} />
    </Panel>
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
        <LatestCheck view={view} base={base} nowSec={nowSec} zone={zone} />
      </div>
      <div className="cp-col">
        <Allocation view={view} />
        <LimitGauges view={view} />
      </div>
    </div>
  );
}
