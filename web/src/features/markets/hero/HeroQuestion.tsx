import { neededMove } from "@agari/core/market";
import { HERO, HERO_HEAD } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { usdLine } from "./units";

interface HeroQuestionProps {
  asset: string;
  /** The ask before the line: "TSLA holds above" by default, "TSLA opens Mon above" on a Gap (session-lanes.md §5). */
  ask?: string;
  /** The line the Window settles against — the oracle's opening print. Null until it exists. */
  openingRaw: bigint | null;
  currentRaw: bigint | null;
}

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
        {winning ? `${usdLine(magnitude, openingRaw)} ${HERO_HEAD.aboveLine}` : `${HERO_HEAD.needs} +${usdLine(magnitude, openingRaw)} ${HERO_HEAD.needsForUp}`}
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
export function HeroQuestion({ asset, ask, openingRaw, currentRaw }: HeroQuestionProps) {
  return (
    <>
      <h2 className="mh-question">
        {openingRaw === null ? (
          HERO_HEAD.pair(asset)
        ) : (
          <>
            {ask ?? HERO_HEAD.holdsAbove(asset)} <span className="mh-question-line">{usdLine(openingRaw)}</span>?
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
