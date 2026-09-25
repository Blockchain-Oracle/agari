import type { Reading } from "@agari/core/schemas";
import { isOk } from "@agari/core/schemas";
import type { Address, EventMarket, LaneBasis, LaneSet, MarketId, Side } from "@agari/core/types";
import { secToMs } from "@agari/core/units";
import { marketsProvider } from "@agari/markets";
import { router } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { laneTabParts, type LaneTabKey } from "@/features/markets/lanes/lane-view";
import { configuredLaneKeys, configuredTickers } from "@/features/markets/lanes/next-window";
import { useLaneNextStart, type LanesState } from "@/features/markets/lanes/useLanes";
import { useMarketSession, type MarketSession } from "@/features/markets/session/useMarketSession";
import { useVenue } from "@/features/markets/useVenue";
import { betweenRoundsLine, MARKETS } from "@/lib/copy";
import { SESSION_COPY } from "@/lib/copy-session";
import { useSessionPhrase } from "@/lib/when";
import { EmptyState, LoadingState, ReadingBoundary } from "~/components/portfolio/web/states";
import { LaneTabs } from "./LaneTabs";
import { openTicket } from "./MarketCard";
import { NextWindowRail, TickerLane } from "./TickerLane";

export interface LaneBoardProps {
  state: LanesState;
  /** The boot reading, when the venue could not even be resolved; defaults to `useVenue()`'s. */
  boot?: Reading<unknown> | null;
  venueId?: Address | null;
  nowMs: number;
  selectedMarketId?: MarketId | null;
  /** Selects a Window (with a side from a card's UP/DOWN). Absent: the ticket opens over the page. */
  onSelect?: (marketId: MarketId, side?: Side) => void;
  /** Opens a Window's Room. Absent: each card mounts its own Room sheet. */
  onOpenRoom?: (market: EventMarket) => void;
}

function laneReading(state: LanesState, boot: Reading<unknown> | null): Reading<LaneSet> | null {
  if (boot && !boot.ok) return boot;
  return state.reading;
}

/** A closed Regular lane with tickers configured lists what opens next (D-086); anything else is between rounds. */
function listsNext(session: MarketSession | null, key: LaneTabKey | null): session is MarketSession {
  return session !== null && !session.open && key !== null && laneTabParts(key).basis === "regular" && configuredTickers(session, key).length > 0;
}

/**
 * web's CadenceLanes (§01 below the section header): the lane tabs — live lanes, and ops' configured lanes while none
 * is live — then the active lane's rail (ticker picker, cards, pager), a closed Regular lane's next-Window cards, or
 * the between-rounds line; loading, broken and empty as web's ReadingBoundary says them.
 */
export function LaneBoard({ state, boot: bootProp, venueId: venueProp, nowMs, selectedMarketId = null, onSelect = openTicket, onOpenRoom }: LaneBoardProps) {
  const venue = useVenue();
  const boot = bootProp === undefined ? venue.boot : bootProp;
  const venueId = venueProp === undefined ? venue.venueId : venueProp;
  const session = useMarketSession();
  const phrase = useSessionPhrase();
  const configured = useMemo(() => configuredLaneKeys(session), [session]);
  const activeKey = state.activeKey ?? configured[0] ?? null;
  const nowSec = Math.floor((nowMs > 0 ? nowMs : marketsProvider.nowMs()) / 1000);
  const closedEmpty = session && !session.open ? { why: SESSION_COPY.lanes.closed(phrase(session.status, nowSec)), nextAction: { label: SESSION_COPY.ticket.readWire, onPress: () => router.push("/news") } } : null;
  const live = state.activeLane !== null && state.activeLane.markets.length > 0;
  return (
    <ReadingBoundary
      reading={laneReading(state, boot)}
      shape="row"
      retry={state.retry}
      isEmpty={(laneSet) => laneSet.lanes.length === 0 && !state.pinnedMissing && configured.length === 0}
      empty={closedEmpty ?? MARKETS.noLiveWindows}
    >
      {(laneSet) => (
        <View style={styles.stack}>
          <LaneTabs lanes={laneSet.lanes} activeKey={activeKey} pinnedMissingKey={state.pinnedMissing ? state.activeKey : null} extraKeys={configured} onPin={state.pin} />
          {live && state.activeLane ? (
            <TickerLane lane={state.activeLane} ticker={state.ticker} onPick={state.pinTicker} session={session} nowMs={nowMs} selectedMarketId={selectedMarketId} onSelect={onSelect} onOpenRoom={onOpenRoom} />
          ) : listsNext(session, activeKey) ? (
            <NextWindowRail laneKey={activeKey as LaneTabKey} session={session} nowSec={nowSec} ticker={state.ticker} onPick={state.pinTicker} onSelect={onSelect} />
          ) : (
            <BetweenRounds venueId={venueId} basis={activeKey ? laneTabParts(activeKey).basis : "regular"} intervalSec={activeKey ? laneTabParts(activeKey).intervalSec : 0} nowMs={nowMs} session={session} />
          )}
        </View>
      )}
    </ReadingBoundary>
  );
}

/** web's BetweenRounds: an empty lane says when its next Window opens — an estimate from the last expiry, never a timetable. */
function BetweenRounds({ venueId, basis, intervalSec, nowMs, session }: { venueId: Address | null; basis: LaneBasis; intervalSec: number; nowMs: number; session: MarketSession | null }) {
  const phrase = useSessionPhrase();
  const closed = basis === "regular" && session !== null && !session.open;
  const next = useLaneNextStart(closed ? null : venueId, intervalSec);
  if (closed) {
    const nowSec = Math.floor((nowMs > 0 ? nowMs : marketsProvider.nowMs()) / 1000);
    return <EmptyState why={SESSION_COPY.lanes.closed(phrase(session.status, nowSec))} nextAction={{ label: SESSION_COPY.ticket.readWire, onPress: () => router.push("/news") }} />;
  }
  if (next === null || nowMs === 0) return <LoadingState shape="line" />;
  const nextStartMs = isOk(next) && next.value !== null && secToMs(next.value) > nowMs ? secToMs(next.value) : null;
  const line = betweenRoundsLine(nextStartMs, nowMs, intervalSec);
  return <EmptyState why={nextStartMs === null ? line : `${line} (${MARKETS.estimated})`} />;
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
});
