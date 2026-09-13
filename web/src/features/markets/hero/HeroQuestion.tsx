import { neededMove } from "@masayume/core/market";
import { formatOracleRaw } from "@masayume/core/units";
import { HERO, HERO_HEAD } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { ORACLE_SCALE } from "./units";

interface HeroQuestionProps {
  asset: string;
  /** The line the Window settles against — the oracle's opening print. Null until it exists. */
  openingRaw: bigint | null;
  currentRaw: bigint | null;
}

/** Whole dollars, grouped — the headline's own scale (Yosuku's `fmtUsd0`). */
const usd0 = (raw: bigint): string => `$${formatOracleRaw(raw, ORACLE_SCALE, 0)}`;

/**
 * How far the live price sits from the line, said once, about UP.
 *
 * The branch comes from `neededMove` rather than a second comparison here — the
 * rule for whether UP is already winning lives in core, and a copy of it is how a
 * fix lands in only one of them.
 */
function HeroDistance({ openingRaw, currentRaw }: { openingRaw: bigint; currentRaw: bigint }) {
  const move = neededMove(currentRaw, openingRaw);
  const winning = move.upNeedsRaw === 0n;
  const magnitude = winning ? currentRaw - openingRaw : move.upNeedsRaw;
  return (
    <div className="mh-distance">
      <span className={cn("mh-distance-value", winning ? "above" : "below")}>
        {winning ? `${usd0(magnitude)} ${HERO_HEAD.aboveLine}` : `${HERO_HEAD.needs} +${usd0(magnitude)} ${HERO_HEAD.needsForUp}`}
      </span>
    </div>
  );
}

/**
 * The headline question and the distance to it.
 *
 * Yosuku asks against a strike derived from spot; Masayume's Windows settle at or
 * above the opening print, so the print is the line. Before it exists there is no
 * line to ask about, and the headline names the pair instead of inventing a level.
 */
export function HeroQuestion({ asset, openingRaw, currentRaw }: HeroQuestionProps) {
  return (
    <>
      <h2 className="mh-question">
        {openingRaw === null ? (
          HERO_HEAD.pair(asset)
        ) : (
          <>
            {HERO_HEAD.holdsAbove(asset)} <span className="mh-question-line">{usd0(openingRaw)}</span>?
          </>
        )}
      </h2>
      {openingRaw === null ? (
        <div className="mh-distance">
          <span className="mh-distance-pending">{HERO.pendingDistance}</span>
        </div>
      ) : currentRaw === null ? (
        <div className="mh-distance">
          <span className="mh-distance-pending">{HERO.noLivePrice}</span>
        </div>
      ) : (
        <HeroDistance openingRaw={openingRaw} currentRaw={currentRaw} />
      )}
    </>
  );
}
