"use client";

import type { Lane } from "@agari/core/types";
import { HERO_HEAD } from "@/lib/copy";
import { compareLaneTabKeys, laneTabKey, laneTabLabel, laneTabParts, type LaneTabKey } from "../lanes/lane-view";

interface HeroCadenceTabsProps {
  lanes: readonly Lane[];
  activeKey: LaneTabKey | null;
  /** A pinned lane with no live Window keeps its slot so the row never shifts under a tap. */
  pinnedMissingKey: LaneTabKey | null;
  onPin: (key: LaneTabKey) => void;
}

interface Slot {
  key: LaneTabKey;
  label: string;
  live: boolean;
}

/**
 * How long the bet runs, beside the headline it governs.
 *
 * Yosuku renders a fixed `['1m','5m','1h']` so a dead lane can sit in place dimmed.
 * Lanes here derive from the live Windows and never from a hardcoded
 * list (FR-6), so the slot that survives an empty lane is the one the user pinned —
 * which is the case that comment is actually protecting. A slot is a (basis, cadence) lane: `5m`, `Gap`, `5m · 24/7`.
 */
function slots(lanes: readonly Lane[], pinnedMissing: LaneTabKey | null): Slot[] {
  const out: Slot[] = lanes.map((lane) => ({
    key: laneTabKey(lane.basis, lane.intervalSec),
    label: laneTabLabel(lane.basis, lane.intervalSec),
    live: lane.markets.length > 0,
  }));
  if (pinnedMissing !== null && !out.some((slot) => slot.key === pinnedMissing)) {
    const { basis, intervalSec } = laneTabParts(pinnedMissing);
    out.push({ key: pinnedMissing, label: laneTabLabel(basis, intervalSec), live: false });
  }
  return out.sort((a, b) => compareLaneTabKeys(a.key, b.key));
}

export function HeroCadenceTabs({ lanes, activeKey, pinnedMissingKey, onPin }: HeroCadenceTabsProps) {
  return (
    <div className="mh-cadence-tabs" role="group" aria-label={HERO_HEAD.cadenceGroup}>
      {slots(lanes, pinnedMissingKey).map((slot) => {
        const on = slot.key === activeKey;
        return (
          <button
            key={slot.key}
            type="button"
            className="mh-cadence"
            aria-pressed={on}
            disabled={!slot.live}
            title={slot.live ? undefined : HERO_HEAD.betweenRounds}
            onClick={() => onPin(slot.key)}
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
