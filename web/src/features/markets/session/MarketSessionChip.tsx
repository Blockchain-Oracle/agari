"use client";

import { MARKETS } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { useMarketSession } from "./useMarketSession";
import "./market-session.css";

/**
 * The NYSE session in one line: "● Open · Closes 16:00 ET", "● Closed · Opens Tue 09:30 ET".
 * Not the session-key chip (`features/session/SessionChip.tsx`). Renders nothing while the session is
 * unknown, so a dead ops process never prints hours it cannot vouch for.
 */
export function MarketSessionChip({ className }: { className?: string }) {
  const session = useMarketSession();
  if (!session) return null;
  const state = session.open ? "open" : "closed";
  const word = MARKETS.session[state];
  return (
    <span className={cn("mks-chip", className)} data-state={state} role="status" aria-label={MARKETS.session.aria(word, session.label)}>
      <span className="mks-chip-dot" aria-hidden />
      <span className="mks-chip-state" aria-hidden>
        {word}
      </span>
      <span aria-hidden>· {session.label}</span>
    </span>
  );
}
