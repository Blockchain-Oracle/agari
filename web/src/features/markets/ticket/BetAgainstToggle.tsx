"use client";

import { TICKET } from "@/lib/copy";
import { setBetAgainst, useBetAgainst } from "../bet-against";

/**
 * "Betting against" — one switch that puts DOWN first everywhere on the page and opens every ticket on it (A-1a).
 *
 * It changes no price, no venue and no counterparty: the bearish trade here is the DOWN side of the same Window,
 * so the switch only decides which side the page offers first. The line under it says exactly that, because a
 * control that looked like a short would be a different product wearing this one's label.
 */
export function BetAgainstToggle() {
  const on = useBetAgainst();
  return (
    <div className="tk-against">
      <button type="button" role="switch" aria-checked={on} className="tk-against-switch" onClick={() => setBetAgainst(!on)} data-cursor="hover">
        <span className="tk-against-track" aria-hidden />
        <span className="tk-against-word">{TICKET.betAgainst}</span>
      </button>
      <p className="tk-against-note">{on ? TICKET.betAgainstOn : TICKET.betAgainstOff}</p>
    </div>
  );
}
