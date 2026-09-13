"use client";

import type { EventMarket } from "@masayume/core/types";
import { formatCadence } from "@masayume/core/market";
import { formatOracleRaw } from "@masayume/core/units";
import { ORACLE_PRICE_SCALE } from "@masayume/markets/identity";
import { useCallback, useState, type ReactNode } from "react";
import { SectionHeader } from "@/components/chrome";
import { MarketRoom } from "@/features/room";
import { HERO_HEAD, SECTIONS } from "@/lib/copy";
import { CadenceLanes, useLanesState } from "./lanes";
import { MarketsHero } from "./MarketsHero";
import { useChainNowMs } from "./useChainNow";
import { useMarketsSelection, type MarketsSelection } from "./useMarketsSelection";
import { SenseiDock } from "@/features/sensei";
import { useVenue } from "./useVenue";
import { WordMarketBoard } from "./word-board";

/** The Room's header line: the question it is about, and which Window that was. */
function roomCallLabel(market: EventMarket): string {
  const cadence = formatCadence(market.intervalSec);
  if (market.openingPriceRaw === null) return `${market.asset} · ${cadence}`;
  return `${HERO_HEAD.holdsAbove(market.asset)} $${formatOracleRaw(market.openingPriceRaw, ORACLE_PRICE_SCALE, 0)}? · ${cadence}`;
}

export interface MarketsScreenProps {
  /** The rail beside the hero chart above 900px; its own drawer below that. */
  renderTicket: (selection: MarketsSelection) => ReactNode;
  /** The result of the Window in the hero, once it has one. */
  renderVerdict: (selection: MarketsSelection) => ReactNode;
}

/**
 * The market you are betting on is the page.
 *
 * The hero carries the question, the chart and the ticket together; the lanes
 * below are how you change it. This inverts the previous arrangement (01 lanes →
 * 02 the window → 03 your call), where reading a market and acting on it were
 * three scroll positions apart.
 */
export function MarketsScreen({ renderTicket, renderVerdict }: MarketsScreenProps) {
  const venue = useVenue();
  const nowMs = useChainNowMs();
  const lanes = useLanesState(venue.venueId);
  const { selection, setSelection } = useMarketsSelection(lanes.laneSet, lanes.activeLane, nowMs);
  // The open Room is held here, not inside the hero or a card — the reference's own
  // reasoning (markets/page.tsx L893–895): mounted at the page, a cadence switch
  // cannot leave it open on a Window the page is no longer showing.
  const [roomMarket, setRoomMarket] = useState<EventMarket | null>(null);
  const openHeroRoom = useCallback(() => setRoomMarket(selection.market), [selection.market]);

  return (
    <>
      <MarketsHero selection={selection} lanes={lanes} onSelect={setSelection} onOpenRoom={openHeroRoom} renderTicket={renderTicket} />

      <div className="markets-main">
        <div className="container">
          {renderVerdict(selection)}

          <section className="markets-section flex flex-col gap-4" aria-label={SECTIONS.lanes.title}>
            <SectionHeader index={SECTIONS.lanes.index} title={SECTIONS.lanes.title} />
            <CadenceLanes
              state={lanes}
              boot={venue.boot}
              venueId={venue.venueId}
              nowMs={nowMs}
              selectedMarketId={selection.marketId}
              onSelect={setSelection}
              onOpenRoom={setRoomMarket}
            />
          </section>

          {/* §02, where the reference puts it: the same live Windows, said in plain language. */}
          <section className="markets-section flex flex-col gap-4" aria-label={SECTIONS.words.title}>
            <SectionHeader index={SECTIONS.words.index} title={SECTIONS.words.title} desc={SECTIONS.words.desc} />
            <WordMarketBoard laneSet={lanes.laneSet} nowMs={nowMs} />
          </section>
        </div>
      </div>

      {/* The dock rides above the page, as the reference mounts it (markets/page.tsx L890). */}
      <SenseiDock laneSet={lanes.laneSet} nowMs={nowMs} />

      {roomMarket && (
        <MarketRoom
          marketId={roomMarket.marketId}
          callLabel={roomCallLabel(roomMarket)}
          onClose={() => setRoomMarket(null)}
          // What unlocks the Room is a position, so "place a bet" selects this
          // Window rather than sending the reader somewhere to find it again.
          onBet={() => {
            setSelection(roomMarket.marketId);
            setRoomMarket(null);
          }}
        />
      )}
    </>
  );
}
