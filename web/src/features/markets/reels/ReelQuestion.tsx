"use client";

import { neededMove } from "@masayume/core/market";
import { formatOracleRaw } from "@masayume/core/units";
import { REELS } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { ORACLE_SCALE } from "../hero/units";

interface ReelQuestionProps {
  asset: string;
  /** The line the Window settles against — the oracle's opening print. Null until it exists. */
  openingRaw: bigint | null;
  currentRaw: bigint | null;
}

/** Whole dollars, grouped — the reference's `usd0`. */
const usd0 = (raw: bigint): string => `$${formatOracleRaw(raw, ORACLE_SCALE, 0)}`;
/** Two decimals — the reference's `usd2`, for the live price under the question. */
const usd2 = (raw: bigint): string => `$${formatOracleRaw(raw, ORACLE_SCALE, 2)}`;

/**
 * How far the live price sits from the line.
 *
 * The reel says it as `+$83 vs line`, which is its own phrasing — the hero says
 * `$83 above the UP line`. What both take from core is the *rule*: whether UP is
 * already winning comes from `neededMove`, never from a comparison written here.
 */
function ReelDistance({ openingRaw, currentRaw }: { openingRaw: bigint; currentRaw: bigint }) {
  const move = neededMove(currentRaw, openingRaw);
  const above = move.upNeedsRaw === 0n;
  const magnitude = above ? currentRaw - openingRaw : move.upNeedsRaw;
  return (
    <span className={cn("reel-distance", above ? "above" : "below")}>
      {above ? "+" : "−"}
      {usd0(magnitude)} {REELS.versusLine}
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
          <span className="reel-question-line">{usd0(openingRaw)}</span>
        )}
        <span className="reel-question-mark">?</span>
      </h2>
      <div className="reel-spot">
        <span>{currentRaw === null ? REELS.noLine : usd2(currentRaw)}</span>
        {currentRaw !== null && openingRaw !== null && <ReelDistance openingRaw={openingRaw} currentRaw={currentRaw} />}
        <span className="reel-spot-label">{REELS.livePrice}</span>
      </div>
    </div>
  );
}
