"use client";

import { RadialGauge } from "@/components/ui/desk-kit";
import { DESK } from "../copy";
import { Panel } from "../DeskPanels";
import { pct, usd } from "../format";
import type { DeskView } from "../view";
import { COCKPIT } from "./copy-cockpit";

const O = COCKPIT.overview;
const share = (part: bigint, whole: bigint): number => (whole <= 0n ? 0 : Number((part * 10_000n) / whole) / 100);

/**
 * Item 6 as gauges (21st Progress radial #3424): spent today against the daily limit, the highest premium held
 * against the ceiling, and the fall from the baseline against the loss stop; the two sizes as plain figures.
 */
export function LimitGauges({ view }: { view: DeskView }) {
  const L = DESK.page.limits;
  const { limits, holdings, plate } = view;
  const top = holdings.filter((h) => h.premiumBps !== null).sort((a, b) => (b.premiumBps ?? 0) - (a.premiumBps ?? 0))[0];
  const topBps = top?.premiumBps ?? null;
  const baseline = view.wire.snapshot?.baselineE6 ? BigInt(view.wire.snapshot.baselineE6) : null;
  const downBps = baseline !== null && plate.totalE6 !== null && baseline > 0n && plate.totalE6 < baseline ? Number(((baseline - plate.totalE6) * 10_000n) / baseline) : 0;
  const gauges = [
    { key: "spent", label: L.spentToday, value: share(limits.spentTodayE6, limits.dailyCapE6), center: `${Math.round(share(limits.spentTodayE6, limits.dailyCapE6))}%`, line: L.spentOf(usd(limits.spentTodayE6, 0), usd(limits.dailyCapE6, 0)) },
    {
      key: "premium",
      label: O.premium,
      value: topBps === null || limits.maxPremiumBps <= 0 ? 0 : Math.max(0, (topBps / limits.maxPremiumBps) * 100),
      center: topBps === null ? "—" : pct(topBps),
      line: top && topBps !== null ? `${top.name} · ${O.ceiling(pct(limits.maxPremiumBps))}` : `${O.premiumNone} · ${O.ceiling(pct(limits.maxPremiumBps))}`,
    },
    { key: "loss", label: O.drawdown, value: limits.lossStopBps <= 0 ? 0 : (downBps / limits.lossStopBps) * 100, center: downBps === 0 ? "0%" : pct(downBps), line: `${downBps === 0 ? O.up : O.down(pct(downBps))} · ${O.stopAt(pct(limits.lossStopBps))}` },
  ];
  return (
    <Panel title={L.title} className="cp-limits">
      <div className="cp-gauges">
        {gauges.map((g) => (
          <div key={g.key} className="cp-gauge">
            <RadialGauge value={g.value} size={72} stroke={7} label={`${g.label}: ${g.line}`}>{g.center}</RadialGauge>
            <div className="cp-gauge-text">
              <span className="cp-stat-label">{g.label}</span>
              <span className="type-caption text-ink-secondary">{g.line}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="cp-figures">
        <div className="cp-figure"><span className="cp-stat-label">{L.perAction}</span><b>{usd(limits.perActionE6, 0)}</b></div>
        <div className="cp-figure"><span className="cp-stat-label">{L.large}</span><b>{usd(limits.largeActionE6, 0)}</b></div>
        <div className="cp-figure"><span className="cp-stat-label">{L.premium}</span><b>{pct(limits.maxPremiumBps)}</b></div>
        <div className="cp-figure"><span className="cp-stat-label">{L.loss}</span><b>{pct(limits.lossStopBps)}</b></div>
      </div>
      {!view.isLive && <p className="type-caption text-ink-muted">{L.practiceNote}</p>}
    </Panel>
  );
}
