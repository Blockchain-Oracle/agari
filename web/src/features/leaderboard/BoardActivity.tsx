"use client";

import type { Reading } from "@agari/core/schemas";
import { SectionHeader } from "@/components/chrome";
import { ActivityList } from "@/features/stats/StatsSections";
import { ago } from "@/features/stats/copy";
import type { TractionData } from "@/features/stats";
import { LEADERBOARD } from "./copy";

interface BoardActivityProps {
  reading: Reading<TractionData> | null;
  /** Chain-corrected clock; 0 before the first client tick. */
  nowMs: number;
}

/**
 * Masayume's "Live activity" (`features/stats/StatsPage.tsx`): the latest calls and cash-outs off the venue's fill
 * tape, each row opening its transaction. The same `/api/traction` read `/stats` polls, so the board adds no scan.
 */
export function BoardActivity({ reading, nowMs }: BoardActivityProps) {
  const words = LEADERBOARD.activity;
  const traction = reading?.ok ? reading.value : null;
  const updated = traction && nowMs > 0 ? words.updated(ago(traction.meta.computedAtMs, nowMs)) : undefined;
  return (
    <section className="lb-activity">
      <SectionHeader index={words.number} title={words.title} desc={words.desc} eyebrow={updated} className="lb-section-head" />
      {traction && nowMs > 0 ? (
        <ActivityList events={traction.recent} decimals={traction.meta.decimals} symbol={traction.meta.symbol} nowMs={nowMs} />
      ) : (
        <div className="stats-activity">
          <div className="stats-activity-empty" role="status">
            {reading !== null && !reading.ok ? words.unreachable : words.reading}
          </div>
        </div>
      )}
    </section>
  );
}
