import { formatCadence } from "@agari/core/copy";
import { isOk } from "@agari/core/schemas";
import type { LaneSet } from "@agari/core/types";
import { useLanes } from "@agari/markets/react";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useVenue } from "@/features/markets/useVenue";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { ACTIVITY_INK } from "./activity-model";
import NextWindow, { type NextWindowProps, type WidgetRow } from "./NextWindowWidget";
import { markUrl } from "./WidgetMarks";

/** The widget lists this many at most (the large size); smaller sizes take the first rows. */
const ROWS_MAX = 6;

/** Every trading Window across the lanes, soonest lock first, and when the next one opens if none trade. */
export function widgetProps(laneSet: LaneSet, nowMs: number): NextWindowProps {
  const rows: WidgetRow[] = laneSet.lanes
    .flatMap((lane) => lane.markets)
    .filter((m) => m.lockAtSec * 1000 > nowMs && m.tradingStartSec * 1000 <= nowMs)
    .sort((a, b) => a.lockAtSec - b.lockAtSec)
    .slice(0, ROWS_MAX)
    .map((m) => ({ asset: m.asset, cadence: formatCadence(m.intervalSec), locksAtMs: m.lockAtSec * 1000, url: `agari://markets/${m.marketId}`, mark: markUrl(m.asset) }));
  const nextStarts = laneSet.lanes.map((lane) => lane.nextStartSec).filter((s): s is number => s !== null && s * 1000 > nowMs);
  const nextMs = nextStarts.length ? Math.min(...nextStarts) * 1000 : null;
  const closedLine = rows.length === 0 && nextMs !== null ? `Next Window opens ${new Date(nextMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "";
  return { rows, closedLine, writtenAtMs: nowMs, ...ACTIVITY_INK };
}

/**
 * Keeps the Home Screen widget's timeline current (iOS; S26.4). One entry per lock time, so the widget redraws and
 * drops a Window the moment it closes even while the app sleeps; rewritten only when the set of Windows changes.
 */
export function useNextWindowWidget(marksVersion: number): readonly string[] {
  const venue = useVenue();
  const lanes = useLanes(Platform.OS === "ios" ? venue.venueId : null);
  const nowMs = useChainNowMs();
  const written = useRef("");
  const [assets, setAssets] = useState<readonly string[]>([]);

  useEffect(() => {
    if (Platform.OS !== "ios" || !lanes || !isOk(lanes) || nowMs === 0) return;
    const props = widgetProps(lanes.value, nowMs);
    const signature = `${props.rows.map((r) => r.url).join(",")}|${props.closedLine}|${marksVersion}`;
    if (signature === written.current) return;
    written.current = signature;
    const names = [...new Set(props.rows.map((r) => r.asset))];
    setAssets((prev) => (prev.join(",") === names.join(",") ? prev : names));
    const at = [nowMs, ...props.rows.map((r) => r.locksAtMs)];
    try {
      NextWindow.updateTimeline(at.map((ms) => ({ date: new Date(ms), props })));
    } catch {
      // No widget extension in this build (a dev client from before S26.4): nothing to feed.
    }
  }, [lanes, nowMs, marksVersion]);

  return assets;
}
