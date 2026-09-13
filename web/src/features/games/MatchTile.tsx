"use client";

import type { MatchState } from "@masayume/core/games";
import { shortHex } from "@masayume/core/units";
import Link from "next/link";
import { useWalletSession } from "@/lib/wallet-session";
import { GAMES } from "./copy";
import { useGames } from "./GamesProvider";

/**
 * Flicky's "your match" tile (`my-match-tile.tsx` L277–330): the opponent, how many cards have settled,
 * whether it is live, and one button in — over the shell's own copy of the match, which the duel stage
 * publishes from real arena events. The PnL sparkline it also carries waits on the projector's per-card
 * marks; the figures here are the ones the reducer already holds.
 */
export function MatchTile({ match }: { match: MatchState }) {
  const { address } = useWalletSession();
  const { feedback } = useGames();
  if (!("matchId" in match)) return null;
  const you = address?.toLowerCase() ?? null;
  const opponent = you === null ? null : match.players.creator.toLowerCase() === you ? match.players.challenger : match.players.creator;
  const cards = "cards" in match ? match.cards.length : 0;
  const settled = "receipts" in match ? match.receipts.filter((r) => r.player.toLowerCase() === you && r.payoutBase !== null).length : 0;
  const live = match.phase !== "finalized" && match.phase !== "refunded";
  const words = GAMES.resume;

  return (
    <section className="gm-plate gm-resume gm-match-tile" aria-label={words.title}>
      <header className="gm-match-head">
        <p className="gm-plate-title">{words.title}</p>
        <span className={`gm-match-badge${live ? " gm-match-badge--live" : ""}`}>
          {live && <span className="gm-match-dot" aria-hidden />}
          {live ? words.live : words.done}
        </span>
      </header>
      <p className="gm-plate-body">{words.body}</p>
      <footer className="gm-match-foot">
        <span className="gm-match-fact">
          <span className="gm-match-k">{words.versus}</span>
          <span className="gm-match-v">{opponent ? shortHex(opponent, 6, 4) : "—"}</span>
        </span>
        {cards > 0 && (
          <span className="gm-match-fact">
            <span className="gm-match-k">{words.settled}</span>
            <span className="gm-match-v">
              {settled} / {cards}
            </span>
          </span>
        )}
        <Link href={`/games/duel/${match.matchId}`} className="gm-resume-cta" onClick={() => feedback("tap")}>
          {live ? words.cta : words.result}
        </Link>
      </footer>
    </section>
  );
}
