"use client";

import { ChevronUpIcon, FeatherIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { TakeComposer, TakeReelCard, useTakes, weaveReel } from "@/features/takes";
import { REELS } from "@/lib/copy";
import { useChainNowMs } from "../useChainNow";
import { useLanesState } from "../lanes";
import { useVenue } from "../useVenue";
import { ReelCard } from "./ReelCard";
import { ReelHolding } from "./ReelHolding";
import { useActiveReel } from "./useActiveReel";
import { useReelPosition } from "./useReelPosition";
import { isClosing, reelPhase, useReelRounds } from "./useReelRounds";

/** A real move, not the first stray pixel of momentum — the reference's own correction. */
const SCROLLED_PX = 60;
/** A take's age prints at a minute's grain, so its card is handed the clock at that grain and re-renders once a minute. */
const MINUTE_MS = 60_000;

/**
 * The reel — a full-screen vertical snap feed of live Windows and community takes.
 *
 * Ported from `reference/yosuku/app/reels/page.tsx` over the same DreamDEX pipeline
 * that feeds `/markets`, so a price never disagrees between the two. Two
 * differences from the reference are deliberate:
 *
 *  - Rounds come from the live lanes across every cadence the venue lists, not a
 *    fixed 1m/5m/1h table, and membership derives from `phase()` like every other
 *    surface rather than a second copy of the entry cutoff.
 *  - The line is the on-chain opening print, as on `/markets`.
 *
 * Takes are woven in as the reference weaves them — market, take, market, take —
 * and read from the social store; with no store configured the reel carries
 * Windows alone and the composer says what is missing.
 */
export function ReelsScreen() {
  const venue = useVenue();
  const nowMs = useChainNowMs();
  const lanes = useLanesState(venue.venueId);
  const rounds = useReelRounds(lanes.laneSet, nowMs);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const waiting = lanes.reading === null || nowMs === 0;
  const feed = useTakes(!waiting);
  const reel = useMemo(() => weaveReel(rounds, feed?.takes ?? []), [rounds, feed]);
  const { register, isNear, activeIndex } = useActiveReel(scrollRef, reel.length);
  useReelPosition(scrollRef, reel, activeIndex);
  const minuteMs = Math.floor(nowMs / MINUTE_MS) * MINUTE_MS;

  // The Take pill only makes sense once there is a live card to attach to — the
  // reference's own rule (L286–289): UP/DOWN stays the first action a viewer meets.
  const hasReel = reel.length > 0;

  return (
    <>
      <div
        ref={scrollRef}
        className="reel-page feed-snap"
        onScroll={(event) => {
          if (event.currentTarget.scrollTop > SCROLLED_PX) setScrolled(true);
        }}
      >
        {waiting ? (
          <ReelHolding>{REELS.reading}</ReelHolding>
        ) : venue.venueId === null ? (
          <ReelHolding>{REELS.noVenue}</ReelHolding>
        ) : !hasReel ? (
          <ReelHolding>{REELS.betweenRounds}</ReelHolding>
        ) : (
          reel.map((item, index) =>
            item.kind === "market" ? (
              <section key={item.market.marketId} ref={register(index)} className="feed-card reel-slot">
                <ReelCard market={item.market} near={isNear(index)} closing={isClosing(reelPhase(item.market, nowMs))} />
              </section>
            ) : (
              <section key={`take-${item.take.id}`} ref={register(index)} className="feed-card reel-slot">
                <TakeReelCard take={item.take} nowMs={minuteMs} />
              </section>
            ),
          )
        )}
      </div>

      {hasReel && (
        <>
          {/* The social entry point, anchored on the right rail mid-card so it never
              covers a card's action row (reference L317–331). */}
          <button type="button" className="reel-take" onClick={() => setComposerOpen(true)} aria-label={REELS.postTake} data-cursor="hover">
            <FeatherIcon size={24} aria-hidden />
            <span>{REELS.take}</span>
          </button>

          {/* Nothing else on screen says this is a snap scroll, so a viewer who does not
              swipe sees one market and assumes that is the whole app. */}
          <div aria-hidden className="reel-hint" data-scrolled={scrolled}>
            <ChevronUpIcon size={20} strokeWidth={3} className="reel-hint-arrow" />
            <span className="reel-hint-pill">{REELS.swipeHint}</span>
          </div>
        </>
      )}

      {composerOpen && <TakeComposer laneSet={lanes.laneSet} nowMs={nowMs} configured={feed?.configured ?? null} onClose={() => setComposerOpen(false)} />}
    </>
  );
}
