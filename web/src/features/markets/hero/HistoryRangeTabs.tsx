"use client";

import { SESSION_COPY } from "@/lib/copy-session";
import { HISTORY_RANGES, type HistoryRange } from "../asset-history/range";

interface HistoryRangeTabsProps {
  range: HistoryRange;
  onPick: (range: HistoryRange) => void;
}

/**
 * The closed hero's span, in the slot Masayume's cadence tabs hold (`.mh-cadence-tabs`, markup for markup). Only the
 * ranges that have a read are drawn — 1D from the signed archive today; 5D/1M/3M join the row when the bars route lands.
 */
export function HistoryRangeTabs({ range, onPick }: HistoryRangeTabsProps) {
  return (
    <div className="mh-cadence-tabs" role="group" aria-label={SESSION_COPY.hero.rangeGroup}>
      {HISTORY_RANGES.map((r) => {
        const on = r === range;
        return (
          <button key={r} type="button" className="mh-cadence" aria-pressed={on} onClick={() => onPick(r)} data-cursor="hover">
            {r}
            {on && <span aria-hidden className="mh-cadence-underline" />}
          </button>
        );
      })}
    </div>
  );
}
