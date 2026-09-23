"use client";

import type { EventMarket, Lane } from "@agari/core/types";
import { LANE_STATE } from "@/lib/copy";
import { etWeekday, laneAssetLabel, type LaneTabKey } from "../lanes/lane-view";
import { AssetDisc } from "./asset-mark";
import { HeroCadenceTabs } from "./HeroCadenceTabs";
import { HeroQuestion } from "./HeroQuestion";
import { HeroSettlesIn } from "./HeroSettlesIn";
import { MarketSessionChip } from "../session";
import { SourceLine } from "../price-source/SourceLine";
import { windowSourceLabel } from "../price-source/source-label";

export interface HeroChartHeadProps {
  market: EventMarket;
  openingRaw: bigint | null;
  currentRaw: bigint | null;
  nowMs: number;
  lanes: readonly Lane[];
  activeLaneKey: LaneTabKey | null;
  pinnedMissingKey: LaneTabKey | null;
  onPin: (key: LaneTabKey) => void;
}

/** Asset, lane length, the question, and the clock — everything you need before choosing a side. */
export function HeroChartHead({
  market,
  openingRaw,
  currentRaw,
  nowMs,
  lanes,
  activeLaneKey,
  pinnedMissingKey,
  onPin,
}: HeroChartHeadProps) {
  const asset = laneAssetLabel(market.asset, market.lane);
  const ask = market.lane === "gap" ? LANE_STATE.gap.opensAbove(asset, etWeekday(market.expirySec)) : undefined;
  return (
    <div className="hero-chart-head">
      <div>
        <div className="mh-asset-row">
          <AssetDisc asset={market.asset} className="mh-asset-badge" />
          <span className="mh-asset-label">{asset}</span>
          <HeroCadenceTabs lanes={lanes} activeKey={activeLaneKey} pinnedMissingKey={pinnedMissingKey} onPin={onPin} />
          <MarketSessionChip asset={asset} />
        </div>
        <HeroQuestion asset={asset} ask={ask} openingRaw={openingRaw} currentRaw={currentRaw} />
        <SourceLine label={windowSourceLabel(market)} className="pair-meta" />
      </div>
      <HeroSettlesIn expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} />
    </div>
  );
}
