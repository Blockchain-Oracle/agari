"use client";

import { cardsInMask } from "@masayume/core/games";
import { isOk } from "@masayume/core/schemas";
import type { Bytes32 } from "@masayume/core/types";
import { formatBaseUnits, shortHex } from "@masayume/core/units";
import { useArenaMatch } from "@masayume/markets/react";
import { useState, type CSSProperties } from "react";
import { LoadingState } from "@/components/states";
import { useVenue } from "@/features/markets";
import { addressHue } from "@/lib/address-hue";
import { DUEL } from "./copy";
import type { DuelCard } from "./duel-card";
import { DuelResultModal } from "./DuelResultModal";

/**
 * `/games/duel/[matchId]` for anyone who is not seated in it — Flicky's read-only result view
 * (`duel-view.tsx` L576–580): the two seats, the verdict, every card's two picks, and the share.
 * Read straight off the arena, so a link to a match works with no wallet and no room. Nothing here
 * is a projection's opinion; the PnL is the contract's own sum.
 */
export function DuelPublicResult({ matchId }: { matchId: Bytes32 }) {
  const reading = useArenaMatch(matchId);
  const { boot } = useVenue();
  const [modalOpen, setModalOpen] = useState(false);
  const decimals = boot && isOk(boot) ? boot.value.collateral.decimals : null;
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const words = DUEL.public;

  if (reading === null) return <LoadingState shape="plate" label={words.reading} />;
  if (!isOk(reading)) return <p className="du-refusal">{words.unreadable}</p>;
  const view = reading.value;
  if (!view) return <p className="du-refusal">{words.unknown}</p>;

  const { match } = view;
  const money = (base: bigint | null) => (base === null || decimals === null ? "—" : formatBaseUnits(base, decimals, { maxDp: 2, minDp: 2 }));
  const signed = (base: bigint) => `${base > 0n ? "+" : base < 0n ? "−" : ""}${money(base < 0n ? -base : base)}`;
  const done = match.status === "finalized";
  const winner = !done ? null : view.creatorPnlBase === view.challengerPnlBase ? null : view.creatorPnlBase > view.challengerPnlBase ? match.creator : match.challenger;
  const card: DuelCard | null =
    done && decimals !== null
      ? {
          matchId,
          verdict: winner === null ? "tied" : winner === match.creator ? "won" : "lost",
          returnPct: null,
          you: match.creator,
          opponent: match.challenger,
          hits: view.picks.filter((p) => p.seat === 0 && p.settled && p.payoutBase > p.costBase).length,
          total: match.deckSize,
          pnlBase: view.creatorPnlBase,
          potAwardedBase: match.potBase === 0n ? null : winner === null ? match.potBase : match.potBase * 2n,
          free: match.potBase === 0n,
          decimals,
          symbol,
        }
      : null;

  return (
    <section className="du-result du-public" aria-label={words.title}>
      <div className="du-plate">
        <span className="du-k">{words.title}</span>
        <div className="du-seats">
          <Seat address={match.creator} pnl={done ? signed(view.creatorPnlBase) : null} won={winner === match.creator} />
          <span className="du-versus" aria-hidden>
            vs
          </span>
          <Seat address={match.challenger} pnl={done ? signed(view.challengerPnlBase) : null} won={winner === match.challenger} />
        </div>
        <p className="du-body">{done ? (winner === null ? words.tied : words.wonBy(shortHex(winner, 6, 4))) : words.status[match.status]}</p>
        <p className="du-foot">{words.readOnly}</p>
        {card && (
          <button type="button" className="du-cta" onClick={() => setModalOpen(true)}>
            {DUEL.result.modal.share}
          </button>
        )}
      </div>

      <div className="du-plate">
        <span className="du-k">{words.cards}</span>
        <ul className="du-picked-list">
          {cardsInMask((1 << match.deckSize) - 1, match.deckSize).map((cardIndex) => {
            const picks = view.picks.filter((p) => p.cardIndex === cardIndex);
            return (
              <li key={cardIndex} className="du-picked-row">
                <span className="du-v">{words.card(cardIndex + 1)}</span>
                <span className="du-k du-mono">{shortHex(view.cards[cardIndex] ?? "", 8, 4)}</span>
                {picks.length === 0 && <span className="du-foot">{words.unplayed}</span>}
                {picks.map((p) => (
                  <span key={p.seat} className="du-foot">
                    <span className={`du-dot du-dot--${p.pick}`} aria-hidden /> {p.seat === 0 ? shortHex(match.creator, 4, 3) : shortHex(match.challenger, 4, 3)} · {p.pick} ·{" "}
                    {p.settled ? `${signed(p.payoutBase - p.costBase)} ${symbol}` : words.open}
                  </span>
                ))}
              </li>
            );
          })}
        </ul>
      </div>

      {card && <DuelResultModal open={modalOpen} onClose={() => setModalOpen(false)} card={card} />}
    </section>
  );
}

function Seat({ address, pnl, won }: { address: string; pnl: string | null; won: boolean }) {
  return (
    <div className="du-seat">
      <span className="du-avatar" style={{ "--du-hue": addressHue(address) } as CSSProperties} aria-hidden />
      <span className="du-seat-name">
        <span className="du-mono">{shortHex(address, 6, 4)}</span>
        {pnl && <span className={`du-k ${won ? "du-up" : ""}`}>{pnl}</span>}
      </span>
    </div>
  );
}
