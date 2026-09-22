"use client";

import { type TickerSymbol } from "@agari/core/market";
import type { MarketId } from "@agari/core/types";
import { useLanes } from "@agari/markets/react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { formatCadence, PREOPEN } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { nextListedWindow } from "../lanes/next-window";
import type { MarketSession } from "../session";
import { useVenue } from "../useVenue";
import { useWhen } from "@/lib/when";

/** Where the seam sits: the hero foot's `.mh-room` control, the placeholder's full-width CTA, or the card's `.mc-room` strip. */
export type ScheduleSeamVariant = "foot" | "cta" | "strip";

export interface ScheduleCallButtonProps {
  asset: TickerSymbol;
  session: MarketSession | null;
  nowSec: number;
  /** Selects the Window: the hero and the dock then show it, and the dock opens the schedule ticket (D-088). */
  onSelect: (marketId: MarketId) => void;
  variant: ScheduleSeamVariant;
  /** The lane the site stands in, so a 5m card offers the 5m Window; the soonest Regular Window otherwise. */
  intervalSec?: number;
  /** The site's own "opens at" instant, for the line when nothing is listed yet. */
  opensSec?: number | null;
  className?: string;
}

/**
 * The pre-open call's seam (D-088): "Schedule a call" on the asset's next listed Regular Window, wherever the closed
 * market shows the asset — the hero's foot, the ticket placeholder, the next-Window card. Each site keeps its own
 * grammar; the seam only decides between the control and, while nothing is listed, the line that says when it will be
 * (the roller lists the next session's first Windows at the close, D-090). Nothing renders until the lanes have read.
 */
export function ScheduleCallButton({ asset, session, nowSec, onSelect, variant, intervalSec, opensSec, className }: ScheduleCallButtonProps) {
  const when = useWhen();
  const { venueId } = useVenue();
  const lanes = useLanes(venueId);
  const laneSet = lanes?.ok ? lanes.value : null;
  const next = useMemo(() => nextListedWindow(laneSet, asset, nowSec, intervalSec), [laneSet, asset, nowSec, intervalSec]);
  if (lanes === null) return null;

  if (next) {
    const cadence = formatCadence(next.intervalSec);
    const which = PREOPEN.seam.which(cadence, when(next.tradingStartSec));
    const aria = PREOPEN.seam.aria(asset, cadence, when(next.tradingStartSec));
    const open = () => onSelect(next.marketId);
    if (variant === "cta") {
      return (
        <Button size="lg" className={cn("w-full", className)} aria-label={aria} onClick={open}>
          {PREOPEN.seam.cta} · {which}
        </Button>
      );
    }
    if (variant === "strip") {
      return (
        <button type="button" className={cn("mc-room", className)} aria-label={aria} data-cursor="hover" onClick={open}>
          <span className="mc-room-label">{PREOPEN.seam.cta}</span>
          <span className="mc-room-hint">{which}</span>
        </button>
      );
    }
    return (
      <button type="button" className={cn("mh-room", className)} aria-label={aria} data-cursor="hover" onClick={open}>
        {PREOPEN.seam.cta}
        <span className="mh-room-meta">{which}</span>
      </button>
    );
  }

  // Nothing listed yet: when it will be, from the session — never a button that cannot act.
  const closesAt = session?.open ? session.status.closesAtSec : null;
  const line = closesAt !== null && closesAt !== undefined ? PREOPEN.seam.listsAtClose(when(closesAt, { clock: true })) : opensSec ? PREOPEN.seam.listsBeforeOpen(when(opensSec)) : null;
  if (line === null) return null;
  if (variant === "cta") return <p className={cn("type-caption text-ink-muted", className)}>{line}</p>;
  if (variant === "strip") return <p className={cn("mc-lists", className)}>{line}</p>;
  return <span className={cn("mh-foot-soft", className)}>{line}</span>;
}
