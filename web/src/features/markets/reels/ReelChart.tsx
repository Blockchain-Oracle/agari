"use client";

import type { EventMarket } from "@masayume/core/types";
import { ReadingBoundary } from "@/components/states";
import { PriceChart } from "../hero/PriceChart";
import { useChartSeries } from "../hero/useChartSeries";

interface ReelChartProps {
  market: EventMarket;
  openingRaw: bigint | null;
}

/**
 * The chart, the hero of the card.
 *
 * Mounted only for the card on screen and its immediate neighbours (see
 * `useActiveReel`) — the series fetch and the chart instance both live in here, so
 * a reel of twenty Windows holds three of them rather than twenty.
 */
export function ReelChart({ market, openingRaw }: ReelChartProps) {
  const series = useChartSeries(market);
  return (
    <ReadingBoundary reading={series} shape="chart">
      {(chart) => <PriceChart points={chart.points} openingRaw={openingRaw} className="h-full w-full" />}
    </ReadingBoundary>
  );
}
