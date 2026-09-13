"use client";

import type { EventMarket, Lane, MarketId, Side } from "@masayume/core/types";
import { useOpeningPrice } from "@masayume/markets/react";
import { ReadingBoundary } from "@/components/states";
import { HeroChartFoot } from "./HeroChartFoot";
import { HeroChartHead } from "./HeroChartHead";
import { HeroYesNo } from "./HeroYesNo";
import { PriceChart } from "./PriceChart";
import { useChartSeries } from "./useChartSeries";
import { useTopOfBook } from "./useTopOfBook";

export interface HeroChartProps {
  market: EventMarket;
  nowMs: number;
  lanes: readonly Lane[];
  activeIntervalSec: number | null;
  pinnedMissingIntervalSec: number | null;
  onPin: (intervalSec: number) => void;
  onSelect: (marketId: MarketId, side: Side) => void;
  onOpenRoom: () => void;
}

/**
 * The hero panel: the question, the chart under it, and the call — one object.
 *
 * Yosuku's arrangement, over the DreamDEX pipeline that was already feeding the
 * old `02 · The window` section. The reading is the same; what changed is that
 * you no longer scroll from the question to the place you answer it.
 */
export function HeroChart({
  market,
  nowMs,
  lanes,
  activeIntervalSec,
  pinnedMissingIntervalSec,
  onPin,
  onSelect,
  onOpenRoom,
}: HeroChartProps) {
  const opening = useOpeningPrice(market.marketId);
  const series = useChartSeries(market);
  const book = useTopOfBook(market);

  const openingRaw = opening?.ok ? opening.value : market.openingPriceRaw;
  const latestRaw = series?.ok ? (series.value.latest?.valueRaw ?? null) : null;

  return (
    <div className="hero-chart">
      <HeroChartHead
        market={market}
        openingRaw={openingRaw}
        currentRaw={latestRaw}
        nowMs={nowMs}
        lanes={lanes}
        activeIntervalSec={activeIntervalSec}
        pinnedMissingIntervalSec={pinnedMissingIntervalSec}
        onPin={onPin}
      />
      <div className="hero-chart-canvas">
        <div className="mh-chart-fill">
          <ReadingBoundary reading={series} shape="chart">
            {(chart) => <PriceChart points={chart.points} openingRaw={openingRaw} className="h-full w-full" />}
          </ReadingBoundary>
        </div>
      </div>
      <HeroChartFoot book={book} asset={market.asset} currentRaw={latestRaw} onOpenRoom={onOpenRoom} />
      <HeroYesNo marketId={market.marketId} upCents={book.upCents} downCents={book.downCents} onSelect={onSelect} />
    </div>
  );
}
