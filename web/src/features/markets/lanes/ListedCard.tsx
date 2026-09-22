"use client";

import type { EventMarket, MarketId } from "@agari/core/types";
import { LANE_STATE, PREOPEN } from "@/lib/copy";
import { AssetDisc } from "../hero/asset-mark";
import { laneAssetLabel, laneCadenceLabel } from "./lane-view";
import { useWhen } from "@/lib/when";

interface ListedCardProps {
  market: EventMarket;
  selected: boolean;
  onSelect: (marketId: MarketId) => void;
}

/**
 * A listed Window before its open on the Regular or Gap lane (D-088): the reference's between-rounds slot
 * (`.market-card-pending`, M `part-06.css:56-70`, as `PausedCard` draws it), now a button — "Schedule a call · opens
 * Wed 09:30 ET" — that opens the ticket in schedule mode. A Gap keeps its own words (when calls open, when it locks,
 * which print settles it) and gains the same strip. The strip is Masayume's Room strip, reused for the one action the
 * card has.
 */
export function ListedCard({ market, selected, onSelect }: ListedCardProps) {
  const when = useWhen();
  const gap = market.lane === "gap";
  const asset = laneAssetLabel(market.asset, market.lane);
  const opens = when(market.tradingStartSec);
  const open = () => onSelect(market.marketId);
  return (
    <article
      className="market-card market-card-pending"
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      aria-label={PREOPEN.card.aria(asset)}
      data-cursor="hover"
      data-lane={market.lane}
      onClick={open}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
    >
      <div className="mc-head">
        <span className="mc-asset">
          <AssetDisc asset={market.asset} className="glyph" />
          <span className="mc-ticker">{asset}</span>
          <span className="mc-cadence">{laneCadenceLabel(market.lane, market.intervalSec)}</span>
        </span>
        <span className="mc-countdown">
          <span className="clock-dot" aria-hidden />
          {PREOPEN.card.clock}
        </span>
      </div>
      <div className="mc-pending">
        <span className="mc-pending-dot" aria-hidden />
        <p className="mc-pending-copy">
          <strong>{gap ? LANE_STATE.gap.listed(opens) : PREOPEN.card.headline(opens)}.</strong> {gap ? LANE_STATE.gap.listedWhy(when(market.lockAtSec), when(market.expirySec, { seconds: true })) : PREOPEN.card.why}
        </p>
      </div>
      <button
        type="button"
        className="mc-room"
        data-cursor="hover"
        onClick={(event) => {
          event.stopPropagation();
          open();
        }}
      >
        <span className="mc-room-label">{PREOPEN.card.cta}</span>
        <span className="mc-room-hint">{PREOPEN.card.hint}</span>
      </button>
    </article>
  );
}
