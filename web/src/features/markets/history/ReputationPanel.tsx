import type { Badge, ReputationData } from "@masayume/core/projection";
import { BadgeGrid } from "./BadgeGrid";
import { HISTORY } from "./copy";

interface ReputationPanelProps {
  reputation: ReputationData;
  badges: readonly Badge[];
}

/** Tier, the record it rests on and the distance to the next one — then the badges. No bonus, no fee: nothing here pays one. */
export function ReputationPanel({ reputation, badges }: ReputationPanelProps) {
  const words = HISTORY.reputation;
  return (
    <div className="flex flex-col gap-4">
      <div className="reputation-plate">
        <div className="flex flex-col gap-1">
          <span className="type-label-micro text-ink-muted">{words.tier}</span>
          <span className="reputation-tier">{words.tiers[reputation.tier]}</span>
          <span className="type-caption text-ink-secondary">{words.record(reputation.bets, reputation.wins)}</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="type-caption text-ink-secondary">{reputation.nextTier ? words.next(words.tiers[reputation.nextTier]) : words.top}</span>
          <div className="reputation-bar" role="progressbar" aria-valuenow={reputation.progressToNext} aria-valuemin={0} aria-valuemax={100} aria-label={words.progress(reputation.progressToNext)}>
            <span style={{ width: `${reputation.progressToNext}%` }} />
          </div>
          <span className="type-caption text-ink-muted">{words.rule}</span>
        </div>
      </div>
      <BadgeGrid badges={badges} />
    </div>
  );
}
