"use client";

import { neededMove } from "@agari/core/market";
import { REELS } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { assetPriceLine, assetSpotLine } from "../hero/units";

interface ReelQuestionProps {
  asset: string;
  /** The line the Window settles against — the oracle's opening print. Null until it exists. */
  openingRaw: bigint | null;
  currentRaw: bigint | null;
}

/**
 * How far the live price sits from the line.
 *
 * The reel says it as `+$83 vs line`, which is its own phrasing — the hero says
 * `$83 above the UP line`. What both take from core is the *rule*: whether UP is
 * already winning comes from `neededMove`, never from a comparison written here.
 */
function ReelDistance({ asset, openingRaw, currentRaw }: { asset: string; openingRaw: bigint; currentRaw: bigint }) {
  const move = neededMove(currentRaw, openingRaw);
  const above = move.upNeedsRaw === 0n;
  const magnitude = above ? currentRaw - openingRaw : move.upNeedsRaw;
  return (
    <span className={cn("reel-distance", above ? "above" : "below")}>
      {above ? "+" : "−"}
      {assetPriceLine(asset, magnitude, openingRaw)} {REELS.versusLine}
    </span>
  );
}

/**
 * The take: the question, the live price, and the distance to the line.
 *
 * Yosuku asks against a strike derived from spot and freezes it per round. These
 * Windows settle at or above the opening print, so the print *is* the line — a real
 * on-chain number that needs no freezing. Until it lands there is nothing to ask
 * about, and the headline says so rather than inventing a level.
 */
export function ReelQuestion({ asset, openingRaw, currentRaw }: ReelQuestionProps) {
  return (
    <div className="reel-ask">
      <h2 className="reel-question">
        {REELS.holdsAbove(asset)}{" "}
        {openingRaw === null ? (
          <span className="reel-question-pending">{REELS.noLine}</span>
        ) : (
          <span className="reel-question-line">{assetPriceLine(asset, openingRaw)}</span>
        )}
        <span className="reel-question-mark">?</span>
      </h2>
      <div className="reel-spot">
        <span>{currentRaw === null ? REELS.noLine : assetSpotLine(asset, currentRaw)}</span>
        {currentRaw !== null && openingRaw !== null && <ReelDistance asset={asset} openingRaw={openingRaw} currentRaw={currentRaw} />}
        <span className="reel-spot-label">{REELS.livePrice}</span>
      </div>
    </div>
  );
}
