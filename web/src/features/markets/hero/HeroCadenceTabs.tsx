"use client";

import type { Lane } from "@masayume/core/types";
import { formatCadence, HERO_HEAD } from "@/lib/copy";

interface HeroCadenceTabsProps {
  lanes: readonly Lane[];
  activeIntervalSec: number | null;
  /** A pinned cadence with no live Window keeps its slot so the row never shifts under a tap. */
  pinnedMissingIntervalSec: number | null;
  onPin: (intervalSec: number) => void;
}

interface Slot {
  intervalSec: number;
  label: string;
  live: boolean;
}

/**
 * How long the bet runs, beside the headline it governs.
 *
 * Yosuku renders a fixed `['1m','5m','1h']` so a dead lane can sit in place dimmed.
 * Lanes here derive from the live `intervalSec` values and never from a hardcoded
 * list (FR-6), so the slot that survives an empty lane is the one the user pinned —
 * which is the case that comment is actually protecting.
 */
function slots(lanes: readonly Lane[], pinnedMissing: number | null): Slot[] {
  const out: Slot[] = lanes.map((lane) => ({
    intervalSec: lane.intervalSec,
    label: lane.label,
    live: lane.markets.length > 0,
  }));
  if (pinnedMissing !== null && !out.some((slot) => slot.intervalSec === pinnedMissing)) {
    out.push({ intervalSec: pinnedMissing, label: formatCadence(pinnedMissing), live: false });
  }
  return out.sort((a, b) => a.intervalSec - b.intervalSec);
}

export function HeroCadenceTabs({ lanes, activeIntervalSec, pinnedMissingIntervalSec, onPin }: HeroCadenceTabsProps) {
  return (
    <div className="mh-cadence-tabs" role="group" aria-label={HERO_HEAD.cadenceGroup}>
      {slots(lanes, pinnedMissingIntervalSec).map((slot) => {
        const on = slot.intervalSec === activeIntervalSec;
        return (
          <button
            key={slot.intervalSec}
            type="button"
            className="mh-cadence"
            aria-pressed={on}
            disabled={!slot.live}
            title={slot.live ? undefined : HERO_HEAD.betweenRounds}
            onClick={() => onPin(slot.intervalSec)}
            data-cursor="hover"
          >
            {slot.label}
            {on && <span aria-hidden className="mh-cadence-underline" />}
          </button>
        );
      })}
    </div>
  );
}
