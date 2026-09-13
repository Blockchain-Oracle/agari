"use client";

import { isOk } from "@masayume/core/schemas";
import type { MarketId, Side } from "@masayume/core/types";
import { mark } from "@masayume/markets/perf";
import type { ReactNode } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { MARKETS } from "@/lib/copy";
import { HeroChart } from "./hero/HeroChart";
import type { LanesState } from "./lanes";
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
/**
 * What the hero shows before it has a Window.
 *
 * These were one branch — "Pick a Window above to read it here" — shown whenever the lane set
 * was not yet a value. That sentence asks the reader to act, so a cold load and a dead RPC both
 * looked like the app waiting for a click it never needed. They are three different facts and
 * they get three different faces: still loading, actually broken, genuinely empty.
 */
function HeroPlaceholder({ lanes }: { lanes: LanesState }) {
  if (lanes.reading === null) return <LoadingState shape="chart" label="Loading live Windows" />;
  if (!isOk(lanes.reading)) return <ErrorState diagnosis={lanes.reading.error} retry={lanes.retry} />;
  return <EmptyState why={MARKETS.noLiveWindows.why} />;
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
              activeIntervalSec={lanes.activeIntervalSec}
              pinnedMissingIntervalSec={lanes.pinnedMissing ? lanes.activeIntervalSec : null}
              onPin={lanes.pin}
              onSelect={onSelect}
              onOpenRoom={onOpenRoom}
            />
          ) : (
            <div className="hero-chart mh-hero-empty">
              <HeroPlaceholder lanes={lanes} />
            </div>
          )}
          {renderTicket(selection)}
        </div>
      </div>
    </section>
  );
}
