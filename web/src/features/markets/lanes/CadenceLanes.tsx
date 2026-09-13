"use client";

import type { Reading } from "@masayume/core/schemas";
import type { Bytes32, EventMarket, LaneSet, MarketId, Side } from "@masayume/core/types";
import { ReadingBoundary } from "@/components/states";
import { MARKETS } from "@/lib/copy";
import { BetweenRounds } from "./BetweenRounds";
import { LaneRows } from "./LaneRows";
import { LaneTabs } from "./LaneTabs";
import { StrikeDisclosure } from "./StrikeDisclosure";
import type { LanesState } from "./useLanes";

interface CadenceLanesProps {
  state: LanesState;
  /** The boot reading's error, when the venue could not even be resolved. */
  boot: Reading<unknown> | null;
  venueId: Bytes32 | null;
  nowMs: number;
  selectedMarketId: MarketId | null;
  onSelect: (marketId: MarketId, side?: Side) => void;
  onOpenRoom: (market: EventMarket) => void;
}

function laneReading(state: LanesState, boot: Reading<unknown> | null): Reading<LaneSet> | null {
  if (boot && !boot.ok) return boot;
  return state.reading;
}

export function CadenceLanes({ state, boot, venueId, nowMs, selectedMarketId, onSelect, onOpenRoom }: CadenceLanesProps) {
  return (
    <ReadingBoundary
      reading={laneReading(state, boot)}
      shape="row"
      isEmpty={(laneSet) => laneSet.lanes.length === 0 && !state.pinnedMissing}
      empty={MARKETS.noLiveWindows}
    >
      {(laneSet) => (
        <div className="flex flex-col gap-4">
          <LaneTabs
            lanes={laneSet.lanes}
            activeIntervalSec={state.activeIntervalSec}
            pinnedMissingIntervalSec={state.pinnedMissing ? state.activeIntervalSec : null}
            onPin={state.pin}
          />
          {state.activeLane === null || state.activeLane.markets.length === 0 ? (
            <BetweenRounds venueId={venueId} intervalSec={state.activeIntervalSec ?? 0} nowMs={nowMs} />
          ) : (
            <LaneRows lane={state.activeLane} nowMs={nowMs} selectedMarketId={selectedMarketId} onSelect={onSelect} onOpenRoom={onOpenRoom} />
          )}
          <StrikeDisclosure count={laneSet.excludedFixedStrike} />
        </div>
      )}
    </ReadingBoundary>
  );
}
