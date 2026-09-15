"use client";

import { sessionPhrase } from "@agari/core/copy";
import type { TickerSymbol } from "@agari/core/market";
import { marketsProvider } from "@agari/markets";
import { useTick } from "@agari/markets/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MARKETS, TICKET } from "@/lib/copy";
import { SESSION_COPY } from "@/lib/copy-session";
import { ScheduleCallButton } from "../hero/ScheduleCallButton";
import { useMarketSession, type MarketSession } from "../session";

const PHRASE_TICK_MS = 30_000;

export interface TicketPlaceholderViewProps {
  asset: TickerSymbol;
  session: MarketSession | null;
  nowSec: number;
}

/**
 * The rail with no Window to call (D-086): the ticket's own panel shell (`.tk-ticket--rail`), saying what the ticket
 * would say, when the market next opens, and what to do meanwhile. The schedule seam renders nothing until 18f.
 */
export function TicketPlaceholderView({ asset, session, nowSec }: TicketPlaceholderViewProps) {
  return (
    <div className="mh-rail">
      <section aria-label={TICKET.title} className="tk-ticket tk-ticket--rail">
        <span className="tk-amount-label">{TICKET.title}</span>
        <p className="type-body text-ink">{MARKETS.ticketPlaceholder.why}</p>
        {session && <p className="type-caption text-ink-secondary">{sessionPhrase(session.status, nowSec)}</p>}
        <p className="type-caption text-ink-muted">{SESSION_COPY.ticket.meanwhile}</p>
        <ScheduleCallButton asset={asset} session={session} />
        <Button variant="secondary" size="sm" render={<Link href={SESSION_COPY.ticket.wireHref(asset)} />}>
          {SESSION_COPY.ticket.readWire} →
        </Button>
      </section>
    </div>
  );
}

export function TicketPlaceholder({ asset }: { asset: TickerSymbol }) {
  const session = useMarketSession(asset);
  useTick(PHRASE_TICK_MS);
  return <TicketPlaceholderView asset={asset} session={session} nowSec={Math.floor(marketsProvider.nowMs() / 1000)} />;
}
