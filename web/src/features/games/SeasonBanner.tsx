"use client";

import { formatSeasonCountdown, seasonRemainingMs } from "@masayume/core/games";
import { useNowMs } from "@/components/data";
import { TrophyMark } from "./art/PixelArt";
import { GAMES } from "./copy";
import type { SeasonView } from "./duel/useSeason";

/**
 * Flicky's season banner (`season-banner.tsx`): a 3:1 strip at the top of the home and the ladder. The
 * reference ships it as a PNG it does not license; this one is drawn — the trophy on the checker ground,
 * the season's name in the pixel face, the pool and the countdown from the same facts the ladder prints.
 */
export function SeasonBanner({ season }: { season: SeasonView }) {
  const nowMs = useNowMs();
  const remaining = nowMs === 0 ? null : seasonRemainingMs(season, nowMs);
  const words = GAMES.rankPage;
  return (
    <div className="gm-season" role="img" aria-label={`${season.name}: ${words.pool(String(season.prizePool.totalUnits), season.prizePool.currency)}`}>
      <TrophyMark className="gm-season-trophy" />
      <div className="gm-season-text">
        <span className="gm-season-eyebrow">{GAMES.seasonBanner.eyebrow}</span>
        <span className="gm-season-name">{season.name}</span>
        <span className="gm-season-line">
          {words.pool(String(season.prizePool.totalUnits), season.prizePool.currency)}
          {remaining !== null && <> · {remaining > 0 ? words.endsIn(formatSeasonCountdown(remaining)) : words.ended}</>}
        </span>
      </div>
      <span className="gm-season-cta">{GAMES.seasonBanner.cta} →</span>
    </div>
  );
}
