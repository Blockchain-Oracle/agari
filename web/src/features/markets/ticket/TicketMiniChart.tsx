"use client";

import type { EventMarket } from "@masayume/core/types";
import { useOpeningPrice } from "@masayume/markets/react";
import { ReadingBoundary } from "@/components/states";
import { PriceChart } from "../hero/PriceChart";
import { useChartSeries } from "../hero/useChartSeries";

/**
 * The drawer's live chart — the reference's first block (`Ticket624Drawer.tsx` L851–855: `lg:hidden`, a
 * 128px canvas in a rounded box, drawn only once there is a series to draw). On the rail the hero chart
 * beside the ticket does this job, so the Ticket mounts this as a drawer only; the series is the hero's
 * own subscription, read once more.
 */
export function TicketMiniChart({ market }: { market: EventMarket }) {
  const series = useChartSeries(market);
  const opening = useOpeningPrice(market.marketId);
  const openingRaw = opening?.ok ? opening.value : market.openingPriceRaw;
  if (series?.ok && series.value.points.length < 2) return null;
  return (
    <div className="tk-mini-chart">
      <div className="tk-mini-chart-canvas">
        <ReadingBoundary reading={series} shape="chart">
          {(chart) => <PriceChart points={chart.points} openingRaw={openingRaw} className="h-full w-full" />}
        </ReadingBoundary>
      </div>
    </div>
  );
}
