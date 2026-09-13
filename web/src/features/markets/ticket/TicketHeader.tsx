"use client";

import { formatCadence } from "@masayume/core/copy";
import type { MarketPhase } from "@masayume/core/lifecycle";
import type { EventMarket } from "@masayume/core/types";
import { Countdown } from "@/components/data";
import { HERO, TICKET } from "@/lib/copy";

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
          {market.asset} · {formatCadence(market.intervalSec)}
        </span>
        <span className="type-caption text-ink-secondary">{phase ? HERO.phase[phase] : TICKET.syncing}</span>
      </div>
      <Countdown expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} className="type-data-lg" />
    </header>
  );
}
