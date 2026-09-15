"use client";

import type { Lane } from "@agari/core/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MARKETS } from "@/lib/copy";
import { compareLaneTabKeys, laneTabKey, laneTabLabel, laneTabParts, type LaneTabKey } from "./lane-view";

interface LaneTabsProps {
  lanes: readonly Lane[];
  activeKey: LaneTabKey | null;
  /** A pinned lane with no live Window keeps its tab so the choice never auto-reverts. */
  pinnedMissingKey: LaneTabKey | null;
  onPin: (key: LaneTabKey) => void;
}

interface Tab {
  key: LaneTabKey;
  label: string;
  count: number;
}

function buildTabs(lanes: readonly Lane[], pinnedMissing: LaneTabKey | null): Tab[] {
  const tabs: Tab[] = lanes.map((lane) => ({ key: laneTabKey(lane.basis, lane.intervalSec), label: laneTabLabel(lane.basis, lane.intervalSec), count: lane.markets.length }));
  if (pinnedMissing !== null) {
    const { basis, intervalSec } = laneTabParts(pinnedMissing);
    tabs.push({ key: pinnedMissing, label: laneTabLabel(basis, intervalSec), count: 0 });
  }
  return tabs.sort((a, b) => compareLaneTabKeys(a.key, b.key));
}

export function LaneTabs({ lanes, activeKey, pinnedMissingKey, onPin }: LaneTabsProps) {
  const tabs = buildTabs(lanes, pinnedMissingKey);
  return (
    <Tabs value={activeKey ?? undefined} onValueChange={(value) => onPin(value as LaneTabKey)}>
      <TabsList variant="line" className="h-touch w-full justify-start overflow-x-auto group-data-horizontal/tabs:h-touch" aria-label="Cadence">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.key} value={tab.key} className="type-body-strong flex-none px-3">
            {tab.label}
            <span className="numbers type-label-micro text-ink-muted" aria-label={MARKETS.live(tab.count)}>
              {tab.count}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
