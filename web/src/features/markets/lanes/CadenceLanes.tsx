"use client";

import type { Reading } from "@agari/core/schemas";
import type { Address, EventMarket, LaneSet, MarketId, Side } from "@agari/core/types";
import { ReadingBoundary } from "@/components/states";
import { MARKETS } from "@/lib/copy";
import { BetweenRounds } from "./BetweenRounds";
import { useMarketSession } from "../session";
import { laneTabParts } from "./lane-view";
import { LaneTabs } from "./LaneTabs";
import { TickerLane } from "./TickerLane";
import type { LanesState } from "./useLanes";

interface CadenceLanesProps {
  state: LanesState;
  /** The boot reading's error, when the venue could not even be resolved. */
  boot: Reading<unknown> | null;
  venueId: Address | null;
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
  const session = useMarketSession();
  return (
    <ReadingBoundary
      reading={laneReading(state, boot)}
      shape="row"
      isEmpty={(laneSet) => laneSet.lanes.length === 0 && !state.pinnedMissing}
      empty={session && !session.open ? MARKETS.closedWindows(session.label) : MARKETS.noLiveWindows}
    >
      {(laneSet) => (
        <div className="flex flex-col gap-4">
          <LaneTabs lanes={laneSet.lanes} activeKey={state.activeKey} pinnedMissingKey={state.pinnedMissing ? state.activeKey : null} onPin={state.pin} />
          {state.activeLane === null || state.activeLane.markets.length === 0 ? (
            <BetweenRounds venueId={venueId} basis={state.activeKey ? laneTabParts(state.activeKey).basis : "regular"} intervalSec={state.activeIntervalSec ?? 0} nowMs={nowMs} session={session} />
          ) : (
            <TickerLane
              lane={state.activeLane}
              ticker={state.ticker}
              onPick={state.pinTicker}
              session={session}
              nowMs={nowMs}
              selectedMarketId={selectedMarketId}
              onSelect={onSelect}
              onOpenRoom={onOpenRoom}
            />
          )}
        </div>
      )}
    </ReadingBoundary>
  );
}
