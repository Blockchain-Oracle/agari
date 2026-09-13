"use client";

import type { EventMarket, Lane, MarketId, Side } from "@masayume/core/types";
import { MarketCard } from "./MarketCard";

interface LaneRowsProps {
  lane: Lane;
  nowMs: number;
  selectedMarketId: MarketId | null;
  onSelect: (marketId: MarketId, side?: Side) => void;
  onOpenRoom: (market: EventMarket) => void;
}

/**
 * The live rail — the reference's `.markets-grid.markets-grid-live`.
 *
 * Soonest-to-expire first; keyed by marketId, never by the recycled pool.
 */
export function LaneRows({ lane, nowMs, selectedMarketId, onSelect, onOpenRoom }: LaneRowsProps) {
  return (
    <div className="markets-grid markets-grid-live">
      {lane.markets.map((market) => (
        <MarketCard
          key={market.marketId}
          market={market}
          nowMs={nowMs}
          selected={market.marketId === selectedMarketId}
          onSelect={onSelect}
          onOpenRoom={onOpenRoom}
        />
      ))}
    </div>
  );
}
