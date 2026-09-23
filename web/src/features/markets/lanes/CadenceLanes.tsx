"use client";

import type { Reading } from "@agari/core/schemas";
import type { Address, EventMarket, LaneSet, MarketId, Side } from "@agari/core/types";
import { marketsProvider } from "@agari/markets";
import { useMemo } from "react";
import { ReadingBoundary } from "@/components/states";
import { MARKETS } from "@/lib/copy";
import { SESSION_COPY } from "@/lib/copy-session";
import { BetweenRounds } from "./BetweenRounds";
import { useMarketSession, type MarketSession } from "../session";
import { laneTabParts, type LaneTabKey } from "./lane-view";
import { LaneTabs } from "./LaneTabs";
import { configuredLaneKeys, configuredTickers } from "./next-window";
import { NextWindowRail } from "./NextWindowRail";
import { TickerLane } from "./TickerLane";
import type { LanesState } from "./useLanes";
import { useSessionPhrase } from "@/lib/when";

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

/** A closed Regular lane with tickers configured lists what opens next (D-086); anything else is between rounds. */
function listsNext(session: MarketSession | null, key: LaneTabKey | null): session is MarketSession {
  return session !== null && !session.open && key !== null && laneTabParts(key).basis === "regular" && configuredTickers(session, key).length > 0;
}

export function CadenceLanes({ state, boot, venueId, nowMs, selectedMarketId, onSelect, onOpenRoom }: CadenceLanesProps) {
  const session = useMarketSession();
  const phrase = useSessionPhrase();
  // The lanes ops configures stand in for live Windows while none exist, so the tabs and the rail never empty.
  const configured = useMemo(() => configuredLaneKeys(session), [session]);
  const activeKey = state.activeKey ?? configured[0] ?? null;
  const nowSec = Math.floor((nowMs > 0 ? nowMs : marketsProvider.nowMs()) / 1000);
  const closedEmpty = session && !session.open ? { why: SESSION_COPY.lanes.closed(phrase(session.status, nowSec)), nextAction: { label: SESSION_COPY.ticket.readWire, href: "/news" } } : null;
  return (
    <ReadingBoundary
      reading={laneReading(state, boot)}
      shape="row"
      isEmpty={(laneSet) => laneSet.lanes.length === 0 && !state.pinnedMissing && configured.length === 0}
      empty={closedEmpty ?? MARKETS.noLiveWindows}
    >
      {(laneSet) => (
        <div className="flex flex-col gap-4">
          <LaneTabs lanes={laneSet.lanes} activeKey={activeKey} pinnedMissingKey={state.pinnedMissing ? state.activeKey : null} extraKeys={configured} onPin={state.pin} />
          {state.activeLane !== null && state.activeLane.markets.length > 0 ? null : listsNext(session, activeKey) ? (
            <NextWindowRail laneKey={activeKey as LaneTabKey} session={session} nowSec={nowSec} ticker={state.ticker} onPick={state.pinTicker} onSelect={onSelect} />
          ) : (
            <BetweenRounds venueId={venueId} basis={activeKey ? laneTabParts(activeKey).basis : "regular"} intervalSec={activeKey ? laneTabParts(activeKey).intervalSec : 0} nowMs={nowMs} session={session} />
          )}
          {state.activeLane !== null && state.activeLane.markets.length > 0 && (
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
