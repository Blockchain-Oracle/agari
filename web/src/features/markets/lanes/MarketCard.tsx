"use client";

import type { EventMarket, MarketId, Side } from "@agari/core/types";
import { useChartSeries } from "../hero/useChartSeries";
import { useTopOfBook } from "../hero/useTopOfBook";
import { MarketCardView } from "./MarketCardView";

interface MarketCardProps {
  market: EventMarket;
  nowMs: number;
  selected: boolean;
  onSelect: (marketId: MarketId, side?: Side) => void;
  /** Opens this Window's Room. The sheet is mounted by the screen, not the card. */
  onOpenRoom: (market: EventMarket) => void;
}

/** The live card: the Window's chart series and top of book read here, drawn by `MarketCardView` (which `/dev` feeds canned). */
export function MarketCard({ market, nowMs, selected, onSelect, onOpenRoom }: MarketCardProps) {
  const series = useChartSeries(market);
  const { upCents, downCents, hydrating } = useTopOfBook(market);
  const points = series?.ok ? series.value.points : [];
  const latestRaw = series?.ok ? (series.value.latest?.valueRaw ?? null) : null;
  return (
    <MarketCardView
      market={market}
      nowMs={nowMs}
      selected={selected}
      onSelect={onSelect}
      onOpenRoom={onOpenRoom}
      points={points}
      latestRaw={latestRaw}
      upCents={upCents}
      downCents={downCents}
      hydrating={hydrating}
    />
  );
}
