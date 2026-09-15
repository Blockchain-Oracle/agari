"use client";

import type { TickerSymbol } from "@agari/core/market";
import type { EventMarket, LaneBasis, MarketId, Side } from "@agari/core/types";
import { MarketCard } from "./MarketCard";
import { PausedCard } from "./PausedCard";

interface LaneRowsProps {
  markets: readonly EventMarket[];
  /** Tickers the roller has paused in this cadence, drawn after the live cards with the roller's own state. */
  paused: readonly (readonly [TickerSymbol, string])[];
  basis: LaneBasis;
  intervalSec: number;
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
export function LaneRows({ markets, paused, basis, intervalSec, nowMs, selectedMarketId, onSelect, onOpenRoom }: LaneRowsProps) {
  return (
    <div className="markets-grid markets-grid-live">
      {markets.map((market) => (
        <MarketCard
          key={market.marketId}
          market={market}
          nowMs={nowMs}
          selected={market.marketId === selectedMarketId}
          onSelect={onSelect}
          onOpenRoom={onOpenRoom}
        />
      ))}
      {paused.map(([asset, state]) => (
        <PausedCard key={asset} asset={asset} basis={basis} intervalSec={intervalSec} state={state} />
      ))}
    </div>
  );
}
