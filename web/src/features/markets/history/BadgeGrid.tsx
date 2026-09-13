import type { Badge } from "@masayume/core/projection";
import { BadgeCheckIcon, ChartNoAxesCombinedIcon, CrownIcon, DropletsIcon, FlameIcon, TargetIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { HISTORY } from "./copy";

const ICONS: Record<Badge["id"], LucideIcon> = {
  first_trade: TargetIcon,
  winning_streak: FlameIcon,
  lp_provider: DropletsIcon,
  whale: ChartNoAxesCombinedIcon,
  oracle: CrownIcon,
};

/**
 * The reference's `BadgeDisplay`, ported: a season-rank cell then one card per badge, numbered,
 * each saying Unlocked or Locked in words. A badge whose source is not connected yet says which
 * capability it waits on instead of pretending to be earnable.
 */
export function BadgeGrid({ badges }: { badges: readonly Badge[] }) {
  const earned = badges.filter((badge) => badge.earned).length;
  const total = badges.length;
  const progress = total > 0 ? Math.round((earned / total) * 100) : 0;
  const next = badges.find((badge) => !badge.earned && badge.pending === null);

  return (
    <div className="badge-display">
      <div className="badge-rank">
        <div>
          <div className="type-label-micro text-ink-muted">{HISTORY.reputation.seasonRank}</div>
          <div className="badge-rank-figure">
            {earned}
            <span className="badge-rank-slash">/</span>
            {total}
          </div>
          <div className="type-caption text-ink-secondary">{next ? HISTORY.reputation.next(HISTORY.badges.names[next.id].name) : HISTORY.reputation.unlocked(earned, total)}</div>
        </div>
        <div className="badge-rank-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={HISTORY.reputation.unlocked(earned, total)}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <ul className="badge-grid">
        {badges.map((badge, index) => {
          const Icon = ICONS[badge.id] ?? BadgeCheckIcon;
          const words = HISTORY.badges.names[badge.id];
          return (
            <li key={badge.id} className={cn("badge-card", badge.earned ? "is-earned" : "is-locked")} title={words.description}>
              <div className="badge-card-head type-label-micro">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span>{badge.earned ? HISTORY.badges.unlocked : badge.pending === "earn" ? HISTORY.badges.pendingEarn : HISTORY.badges.locked}</span>
              </div>
              <div className="badge-card-icon" aria-hidden="true">
                <Icon strokeWidth={1.9} />
              </div>
              <div className="type-body-strong text-ink">{words.name}</div>
              <div className="type-caption text-ink-secondary">{words.description}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
