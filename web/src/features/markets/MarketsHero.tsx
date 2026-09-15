"use client";

import { LAUNCH_TICKERS, type TickerSymbol } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import type { MarketId, Side } from "@agari/core/types";
import { mark } from "@agari/markets/perf";
import type { ReactNode } from "react";
import { ErrorState, LoadingState } from "@/components/states";
import { HeroAssetChart } from "./hero/HeroAssetChart";
import { HeroChart } from "./hero/HeroChart";
import type { LanesState } from "./lanes";
import { TicketPlaceholder } from "./ticket/TicketPlaceholder";
import type { MarketsSelection } from "./useMarketsSelection";

export interface MarketsHeroProps {
  selection: MarketsSelection;
  lanes: LanesState;
  onSelect: (marketId: MarketId, side: Side) => void;
  /** Opens the Room for the Window in the hero. Held by the screen, not here — see MarketsScreen. */
  onOpenRoom: () => void;
  /** The ticket rail; it renders itself into the grid's second column, or as a drawer. */
  renderTicket: (selection: MarketsSelection) => ReactNode;
}

/**
 * The page hero — the question, the chart, and the ticket as one object.
 *
 * Ported from `reference/yosuku/app/markets/page.tsx`. The reference's structural
 * claim is that the market you are betting on is the page, not a card inside it:
 * the lanes below became a way to change the hero rather than a list you pick from
 * and then scroll past.
 */
/** The hero's asset when no Window is selected: the rail's pinned ticker, else the registry's first launch ticker. */
const DEFAULT_ASSET: TickerSymbol = LAUNCH_TICKERS[0] ?? "TSLA";

/**
 * What the hero shows before it has a Window.
 *
 * These were one branch — "Pick a Window above to read it here" — shown whenever the lane set
 * was not yet a value. That sentence asks the reader to act, so a cold load and a dead RPC both
 * looked like the app waiting for a click it never needed. Two faces remain here: still loading,
 * actually broken. A lane set with no Window in it is the asset hero (D-086), never an empty panel.
 */
function HeroPlaceholder({ lanes }: { lanes: LanesState }) {
  if (lanes.reading === null) return <LoadingState shape="chart" label="Loading live Windows" />;
  if (!isOk(lanes.reading)) return <ErrorState diagnosis={lanes.reading.error} retry={lanes.retry} />;
  return <LoadingState shape="chart" />;
}

export function MarketsHero({ selection, lanes, onSelect, onOpenRoom, renderTicket }: MarketsHeroProps) {
  const laneList = lanes.laneSet?.lanes ?? [];
  if (selection.market) mark("route.useful", "markets.hero");
  return (
    <section className="page-hero markets-hero">
      <span className="crop tl" />
      <span className="crop tr" />
      <span className="crop bl" />
      <span className="crop br" />

      <div className="container">
        <div className="hero-grid hero-grid-mini">
          {selection.market ? (
            <HeroChart
              market={selection.market}
              nowMs={selection.nowMs}
              lanes={laneList}
              activeLaneKey={lanes.activeKey}
              pinnedMissingKey={lanes.pinnedMissing ? lanes.activeKey : null}
              onPin={lanes.pin}
              onSelect={onSelect}
              onOpenRoom={onOpenRoom}
            />
          ) : lanes.laneSet ? (
            <HeroAssetChart asset={lanes.ticker ?? DEFAULT_ASSET} tickers={LAUNCH_TICKERS} onPickAsset={lanes.pinTicker} />
          ) : (
            <div className="hero-chart mh-hero-empty">
              <HeroPlaceholder lanes={lanes} />
            </div>
          )}
          {selection.market ? renderTicket(selection) : lanes.laneSet ? <TicketPlaceholder asset={lanes.ticker ?? DEFAULT_ASSET} /> : null}
        </div>
      </div>
    </section>
  );
}
