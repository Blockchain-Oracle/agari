"use client";

import { phase } from "@masayume/core/lifecycle";
import type { EventMarket, MarketId, Side } from "@masayume/core/types";
import { marketsProvider } from "@masayume/markets";
import { useMarket, useOnchain, useOpeningPrice, useTick } from "@masayume/markets/react";
import { ReadingBoundary } from "@/components/states";
import { HERO } from "@/lib/copy";
import { ChartLegend } from "./ChartLegend";
import { CountdownBlock } from "./CountdownBlock";
import { DepthStrip } from "./DepthStrip";
import { DistanceReadout } from "./DistanceReadout";
import { HeroHeader } from "./HeroHeader";
import { oraclePriceText } from "./OraclePrice";
import { PriceChart } from "./PriceChart";
import { PriceSourceNote } from "./PriceSourceNote";
import { useChartSeries } from "./useChartSeries";

const RENDER_TICK_MS = 1_000;

export interface HeroMarketProps {
  marketId: MarketId;
  /** Emphasizes one side of the distance readout; the Ticket passes the chosen side. */
  side?: Side;
}

function HeroBody({ market, side }: { market: EventMarket; side?: Side }) {
  const opening = useOpeningPrice(market.marketId);
  const onchain = useOnchain(market.marketId);
  const series = useChartSeries(market);
  useTick(RENDER_TICK_MS);
  const nowMs = marketsProvider.nowMs();

  const openingRaw = opening?.ok ? opening.value : market.openingPriceRaw;
  const latestRaw = series?.ok ? (series.value.latest?.valueRaw ?? null) : null;
  const currentPhase = phase({ ...market, openingPriceRaw: openingRaw, onchainStatus: onchain?.ok ? onchain.value.status : null }, nowMs);

  return (
    <article
      aria-label={HERO.chartLabel(market.asset, oraclePriceText(openingRaw), oraclePriceText(latestRaw))}
      className="flex flex-col gap-4 rounded-(--market-card-radius) border border-(--market-card-border) bg-(--market-card-surface) p-4"
    >
      <HeroHeader market={market} phase={currentPhase} />
      <ChartLegend openingRaw={openingRaw} latestRaw={latestRaw} />
      <ReadingBoundary reading={series} shape="chart">
        {(chart) => <PriceChart points={chart.points} openingRaw={openingRaw} />}
      </ReadingBoundary>
      <div className="flex items-center gap-6">
        <CountdownBlock expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} />
        <DistanceReadout openingRaw={openingRaw} currentRaw={latestRaw} side={side} />
      </div>
      <DepthStrip market={market} />
      <PriceSourceNote />
    </article>
  );
}

/** The featured window as a live chart you can read and act from in one motion (FR-7). */
export function HeroMarket({ marketId, side }: HeroMarketProps) {
  const market = useMarket(marketId);
  return (
    <ReadingBoundary reading={market} shape="chart" isEmpty={(m) => m === null} empty={HERO.notFound}>
      {(m) => (m ? <HeroBody market={m} side={side} /> : null)}
    </ReadingBoundary>
  );
}
