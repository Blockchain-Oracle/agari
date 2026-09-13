"use client";

import { formatBaseUnits } from "@masayume/core/units";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { ago, fmtCount, STATS } from "./copy";
import { GrowthCurve } from "./GrowthCurve";
import { ActivityList, SectionHead, Stat } from "./StatsSections";
import { useTraction } from "./useTraction";

/**
 * `/stats` — ported from `reference/yosuku/app/stats/page.tsx`: the hero that answers "can they
 * get users?" in five seconds, then Growth, Adoption and Live activity. The reference proved its
 * numbers through the gas it sponsored; Masayume sponsors nothing, so the proof is the venue's
 * own fill tape, over the last 24 hours the indexer serves in one scan. Nothing here is floored
 * against a stored high-water mark: a rolling day legitimately goes down.
 */
export function StatsPage() {
  const reading = useTraction();
  const nowMs = useChainNowMs();
  const t = reading?.ok ? reading.value : null;
  const failed = reading !== null && !reading.ok;

  return (
    <div className="stats">
      <section className="page-hero stats-hero">
        <span className="crop tl" />
        <span className="crop tr" />
        <span className="crop bl" />
        <span className="crop br" />
        <div className="container">
          <div className="hero-grid">
            <div className="hero-left">
              <div className="eyebrow">
                <span className="dash" />
                <span className="live-dot" />
                <span>{STATS.hero.eyebrow}</span>
              </div>
              <h1 className="page-title">
                {STATS.hero.titleLead}
                <br />
                <span className="accent">{STATS.hero.titleAccent}</span>.
              </h1>
              <p className="stats-lede">{STATS.hero.lede}</p>
            </div>

            <div className="stats-headline">
              <div className="stats-headline-eyebrow">
                <span className="stats-headline-dot" />
                <span>{STATS.hero.headline}</span>
              </div>
              <div className="stats-headline-value">{t ? fmtCount(t.wallets) : "—"}</div>
              <div className="stats-headline-caption">{STATS.hero.headlineCaption}</div>
              <div className="stats-headline-foot">
                <div className="stats-headline-foot-label">{STATS.hero.headlineFoot}</div>
                <div className="stats-headline-foot-value">{t ? fmtCount(t.calls) : "—"}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container stats-main">
        <div className="stats-body">
          {!t && !failed ? (
            <div className="stats-reading">{STATS.reading}</div>
          ) : t ? (
            <>
              <SectionHead {...STATS.sections.growth} />
              <div className="stats-curve-card">
                <GrowthCurve points={t.curve} />
              </div>

              <SectionHead {...STATS.sections.adoption} />
              <div className="stats-grid">
                <Stat label={STATS.stats.wallets.label} value={fmtCount(t.wallets)} sub={STATS.stats.wallets.sub} accent />
                <Stat label={STATS.stats.calls.label} value={fmtCount(t.calls)} sub={STATS.stats.calls.sub} />
                <Stat
                  label={STATS.stats.staked.label}
                  value={formatBaseUnits(t.stakedBase, t.meta.decimals)}
                  sub={t.meta.complete ? STATS.stats.staked.onLine(t.meta.symbol) : STATS.stats.staked.floor(t.meta.symbol)}
                />
                <Stat label={STATS.stats.settled.label} value={fmtCount(t.settledWindows)} sub={STATS.stats.settled.sub(t.windows)} />
              </div>
              <p className="stats-note">
                {STATS.attribution(t.unattributed)}
                {!t.meta.complete && ` ${STATS.floor}`}
              </p>

              <SectionHead {...STATS.sections.activity} right={<span className="stats-updated">{STATS.activity.updated(ago(t.meta.computedAtMs, nowMs))}</span>} />
              <ActivityList events={t.recent} decimals={t.meta.decimals} symbol={t.meta.symbol} nowMs={nowMs} />

              <p className="stats-foot">{STATS.foot}</p>
            </>
          ) : (
            <div className="stats-unreachable">{STATS.unreachable}</div>
          )}
        </div>
      </div>
    </div>
  );
}
