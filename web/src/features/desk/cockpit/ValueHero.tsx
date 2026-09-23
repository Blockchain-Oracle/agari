"use client";

import { ChartArea } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { EmptyState, NumberTicker } from "@/components/ui/desk-kit";
import { cn } from "@/lib/utils";
import { DESK } from "../copy";
import { ago, pctSigned, usd, usdSigned } from "../format";
import { seriesInRange, type ChartRange, type DeskView } from "../view";
import { COCKPIT } from "./copy-cockpit";

const AreaChartClient = dynamic(() => import("@/components/ui/desk-kit/AreaChart.client").then((m) => m.AreaChartClient), {
  ssr: false,
  loading: () => <div className="cp-chart-skeleton" aria-hidden />,
});

const RANGES: readonly ChartRange[] = ["1d", "1w", "all"];
/** Floats only at the display edge: a dollar figure for the ticker and the canvas. */
const dollars = (e6: bigint): number => Number(e6) / 1_000_000;
const tone = (e6: bigint | null): "up" | "down" | "flat" => (e6 === null || e6 === 0n ? "flat" : e6 > 0n ? "up" : "down");

/**
 * The plate, as 21st's Portfolio Chart (#29532): the total rolling in, the move since the money went in, the value
 * at every check on an area chart with 1D · 1W · All, the timing line and when it was valued.
 */
export function ValueHero({ view, nowSec }: { view: DeskView; nowSec: number }) {
  const P = DESK.page.plate;
  const H = COCKPIT.hero;
  const { plate } = view;
  const [range, setRange] = useState<ChartRange>("all");
  const inRange = useMemo(() => seriesInRange(view.series, range, nowSec), [view.series, range, nowSec]);
  const points = useMemo(() => inRange.points.map((p) => ({ timeSec: p.atSec, value: dollars(p.totalE6) })), [inRange.points]);
  const baseline = view.wire.snapshot?.baselineE6 ? dollars(BigInt(view.wire.snapshot.baselineE6)) : null;

  if (plate.totalE6 === null) {
    return (
      <section className="cp-card cp-hero" aria-label={P.title}>
        <span className="dk-panel-title">{P.title}</span>
        <EmptyState icon={<ChartArea />} title={H.emptyTitle} body={P.notYet} />
        {!view.isLive && <p className="type-caption text-ink-muted">{P.practiceCash(usd(plate.cashE6))}</p>}
      </section>
    );
  }
  return (
    <section className="cp-card cp-hero" aria-label={P.title}>
      <div className="cp-hero-top">
        <div className="cp-hero-figures">
          <span className="dk-panel-title">{P.total}</span>
          <span className="cp-hero-total">
            <span className="cp-hero-currency">$</span>
            <NumberTicker value={dollars(plate.totalE6)} format="plain" />
          </span>
          <div className="cp-hero-moves">
            {plate.sinceE6 !== null && (
              <span className="cp-move" data-tone={tone(plate.sinceE6)}>
                {usdSigned(plate.sinceE6)}
                <span className="cp-move-label">{P.since.toLowerCase()}</span>
              </span>
            )}
            {inRange.deltaE6 !== null && inRange.bps !== null && (
              <span className="cp-move" data-tone={tone(inRange.deltaE6)}>
                {pctSigned(inRange.bps)}
                <span className="cp-move-label">{H.rangeMove[range]}</span>
              </span>
            )}
          </div>
        </div>
        <div className="cp-ranges" role="group" aria-label={H.rangesAria}>
          {RANGES.map((r) => (
            <button key={r} type="button" className="cp-range" aria-pressed={range === r} onClick={() => setRange(r)}>
              {H.ranges[r]}
            </button>
          ))}
        </div>
      </div>
      <div className="cp-chart" role="img" aria-label={H.chartAria}>
        {points.length >= 2 ? <AreaChartClient points={points} baseline={baseline} tone={tone(inRange.deltaE6)} className="h-56" /> : <p className="cp-chart-empty type-caption text-ink-muted">{H.oneCheck}</p>}
      </div>
      <div className="cp-hero-foot">
        <div className="cp-stat">
          <span className="cp-stat-label">{P.timing}</span>
          <span className={cn("cp-stat-value", plate.timing.graded > 0 && (plate.timing.bps >= 0 ? "text-profit" : "text-loss"))}>{plate.timing.graded === 0 ? "—" : pctSigned(plate.timing.bps)}</span>
        </div>
        <p className="type-caption text-ink-muted">
          {plate.timing.graded === 0 ? P.timingNone : `${P.timingValue(pctSigned(plate.timing.bps), plate.timing.graded)}. ${P.timingNote}`}
          {plate.valuedAtSec !== null ? ` ${P.valued(ago(plate.valuedAtSec, nowSec))}` : ""}
        </p>
      </div>
    </section>
  );
}
