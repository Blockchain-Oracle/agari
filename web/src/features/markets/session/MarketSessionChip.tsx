"use client";

import { isTickerSymbol } from "@agari/core/market";
import { MARKETS } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { haltLabel, useMarketSession, type MarketSession } from "./useMarketSession";
import "./market-session.css";

interface MarketSessionChipProps {
  /** The Window's asset (a ticker, or the xStock of a token Window): its halt replaces the hours while it holds. */
  asset?: string;
  className?: string;
}

/**
 * A halt shows in regular hours for a stock lane (the calendar's `halted` state), and at any hour for a token lane, which
 * trades through nights and weekends while the NYSE line would only say when the stock market opens.
 */
function haltShown(session: MarketSession, asset: string | undefined): boolean {
  if (!session.halt) return false;
  return session.status.state === "halted" || (asset !== undefined && !isTickerSymbol(asset));
}

/**
 * The NYSE session in one line: "● Open · Closes 16:00 ET", "● Closed · Opens Tue 09:30 ET". A halted asset says only
 * why, once: "● Trading halted" or "● Signed price stale" (Q-S6-9). Not the session-key chip (`features/session/SessionChip.tsx`).
 */
export function MarketSessionChipView({ session, asset, className }: MarketSessionChipProps & { session: MarketSession }) {
  if (session.halt && haltShown(session, asset)) {
    const label = haltLabel(session.halt);
    return (
      <span className={cn("mks-chip", className)} data-state="halted" role="status" aria-label={MARKETS.session.aria(MARKETS.session.halted, label)}>
        <span className="mks-chip-dot" aria-hidden />
        <span className="mks-chip-state mks-chip-halt" aria-hidden>
          {label}
        </span>
      </span>
    );
  }
  const state = session.open ? "open" : "closed";
  const word = MARKETS.session[state];
  return (
    <span className={cn("mks-chip", className)} data-state={state} role="status" aria-label={MARKETS.session.aria(word, session.label)}>
      <span className="mks-chip-dot" aria-hidden />
      <span className="mks-chip-state" aria-hidden>
        {word}
      </span>
      <span className="mks-chip-sep" aria-hidden>
        ·
      </span>
      <span aria-hidden>{session.label}</span>
    </span>
  );
}

/** Renders nothing while the session is unknown, so a dead ops process never prints hours it cannot vouch for. */
export function MarketSessionChip({ asset, className }: MarketSessionChipProps) {
  const session = useMarketSession(asset);
  return session ? <MarketSessionChipView session={session} asset={asset} className={className} /> : null;
}
