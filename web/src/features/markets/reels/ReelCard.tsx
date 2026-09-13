"use client";

import type { EventMarket } from "@masayume/core/types";
import { useOpeningPrice } from "@masayume/markets/react";
import { memo } from "react";
import { REELS } from "@/lib/copy";
import { useOracleSpot } from "../hero/useOracleSpot";
import { ReelCall } from "./ReelCall";
import { ReelChart } from "./ReelChart";
import { ReelHead } from "./ReelHead";
import { ReelQuestion } from "./ReelQuestion";

interface ReelCardProps {
  market: EventMarket;
  /** False for a card more than one swipe away: it keeps its frame and reads nothing live. */
  near: boolean;
  /** The Window no longer takes entries — the call row says so instead of offering a side. */
  closing: boolean;
}

/**
 * One Window as a framed portrait card — the question, the tape, and the call.
 *
 * Ported from `reference/yosuku/app/reels/page.tsx` (`ReelCard`, L57) over the DreamDEX pipeline.
 * Everything on it is a real read: the round comes from the live lanes, the line is the on-chain
 * opening print, the price is the feed the Window settles on. Nothing here is a placeholder number.
 *
 * Memoised, and the clock stays out of its props: the head reads the clock itself, `closing` is a
 * fact that changes once, so a card off screen re-renders when its Window changes and not sixty
 * times a minute. Every live read is gated on `near`: the lane set already carries each Window's
 * opening print (one read for the whole reel), and the per-card refinement plus the price
 * subscription belong only to the card on screen and its two neighbours — the reference gates its
 * redraw the same way, on an IntersectionObserver.
 */
export const ReelCard = memo(function ReelCard({ market, near, closing }: ReelCardProps) {
  const opening = useOpeningPrice(near ? market.marketId : null);
  const spotRaw = useOracleSpot(near ? market.asset : null);
  const openingRaw = opening?.ok ? opening.value : market.openingPriceRaw;

  return (
    <article className="reel-card">
      <div aria-hidden className="reel-grain" />
      <div aria-hidden className="reel-heat" />

      <ReelHead market={market} />
      <ReelQuestion asset={market.asset} openingRaw={openingRaw} currentRaw={spotRaw} />

      <div className="reel-chart">
        {near ? (
          <ReelChart market={market} openingRaw={openingRaw} />
        ) : (
          <p className="reel-chart-holding">{REELS.swipeToRead}</p>
        )}
      </div>

      <ReelCall marketId={market.marketId} closing={closing} />
    </article>
  );
});
