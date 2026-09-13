"use client";

import type { Lane } from "@masayume/core/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCadence, MARKETS } from "@/lib/copy";

interface LaneTabsProps {
  lanes: readonly Lane[];
  activeIntervalSec: number | null;
  /** A pinned cadence with no live Window keeps its tab so the choice never auto-reverts. */
  pinnedMissingIntervalSec: number | null;
  onPin: (intervalSec: number) => void;
}

interface Tab {
  intervalSec: number;
  label: string;
  count: number;
}

function buildTabs(lanes: readonly Lane[], pinnedMissing: number | null): Tab[] {
  const tabs: Tab[] = lanes.map((lane) => ({ intervalSec: lane.intervalSec, label: lane.label, count: lane.markets.length }));
  if (pinnedMissing !== null) tabs.push({ intervalSec: pinnedMissing, label: formatCadence(pinnedMissing), count: 0 });
  return tabs.sort((a, b) => a.intervalSec - b.intervalSec);
}

export function LaneTabs({ lanes, activeIntervalSec, pinnedMissingIntervalSec, onPin }: LaneTabsProps) {
  const tabs = buildTabs(lanes, pinnedMissingIntervalSec);
  return (
    <Tabs value={activeIntervalSec === null ? undefined : String(activeIntervalSec)} onValueChange={(value) => onPin(Number(value))}>
      <TabsList variant="line" className="h-touch w-full justify-start overflow-x-auto group-data-horizontal/tabs:h-touch" aria-label="Cadence">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.intervalSec} value={String(tab.intervalSec)} className="type-body-strong flex-none px-3">
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
