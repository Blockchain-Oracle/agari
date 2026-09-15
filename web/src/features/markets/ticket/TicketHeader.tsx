"use client";

import type { MarketPhase } from "@agari/core/lifecycle";
import type { EventMarket } from "@agari/core/types";
import { Countdown } from "@/components/data";
import { HERO, TICKET } from "@/lib/copy";
import { laneAssetLabel, laneTabLabel } from "../lanes/lane-view";

interface TicketHeaderProps {
  market: EventMarket;
  phase: MarketPhase | null;
  nowMs: number;
}

export function TicketHeader({ market, phase, nowMs }: TicketHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="type-title text-ink">
          {laneAssetLabel(market.asset, market.lane)} · {laneTabLabel(market.lane, market.intervalSec)}
        </span>
        <span className="type-caption text-ink-secondary">{phase ? HERO.phase[phase] : TICKET.syncing}</span>
      </div>
      <Countdown expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} className="type-data-lg" />
    </header>
  );
}
