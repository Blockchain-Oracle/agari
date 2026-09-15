"use client";

import { sessionPhrase, sessionStateWord } from "@agari/core/copy";
import { haltLabel, isTickerSymbol } from "@agari/core/market";
import { marketsProvider } from "@agari/markets";
import { useTick } from "@agari/markets/react";
import { MARKETS } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { useMarketSession, type MarketSession } from "./useMarketSession";
import "./market-session.css";

/** The countdown in the phrase moves by the minute; a 30 s beat keeps it honest without a render a second. */
const PHRASE_TICK_MS = 30_000;

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
 * The NYSE session as a word and a phrase (D-087): "● Open · closes in 2h 05m", "● Pre-market · opens in 1h 12m",
 * "● After hours · reopens Tue 09:30 ET", "● Weekend · reopens Mon 09:30 ET". A halted asset says only why, once:
 * "● Trading halted" or "● Signed price stale" (Q-S6-9). Not the session-key chip (`features/session/SessionChip.tsx`).
 * `nowSec` is for fixtures, which read a canned clock; live callers leave it to the chain-corrected one.
 */
export function MarketSessionChipView({ session, asset, className, nowSec }: MarketSessionChipProps & { session: MarketSession; nowSec?: number }) {
  useTick(PHRASE_TICK_MS);
  if (session.halt && haltShown(session, asset)) {
    const label = haltLabel(session.halt.reason);
    return (
      <span className={cn("mks-chip", className)} data-state="halted" role="status" aria-label={MARKETS.session.aria(MARKETS.session.halted, label)}>
        <span className="mks-chip-dot" aria-hidden />
        <span className="mks-chip-state mks-chip-halt" aria-hidden>
          {label}
        </span>
      </span>
    );
  }
  const now = nowSec ?? Math.floor(marketsProvider.nowMs() / 1000);
  const word = sessionStateWord(session.status);
  const phrase = sessionPhrase(session.status, now);
  // The phrase is "<word> · <tail>"; the tail alone follows the dot. Without a tail (no known open) the label stands in.
  const tail = phrase.startsWith(`${word} · `) ? phrase.slice(word.length + 3) : session.label;
  return (
    <span className={cn("mks-chip", className)} data-state={session.status.state} role="status" aria-label={MARKETS.session.aria(word, tail)}>
      <span className="mks-chip-dot" aria-hidden />
      <span className="mks-chip-state" aria-hidden>
        {word}
      </span>
      <span className="mks-chip-sep" aria-hidden>
        ·
      </span>
      <span aria-hidden>{tail}</span>
    </span>
  );
}

/** Renders nothing while the session is unknown, so a dead ops process never prints hours it cannot vouch for. */
export function MarketSessionChip({ asset, className }: MarketSessionChipProps) {
  const session = useMarketSession(asset);
  return session ? <MarketSessionChipView session={session} asset={asset} className={className} /> : null;
}
