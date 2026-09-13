"use client";

import { STAKE_TIERS, cardPnl, everyCardSettled, picksComplete, type CardReceipt, type MatchState } from "@masayume/core/games";
import { isOk } from "@masayume/core/schemas";
import type { Address, Bytes32, MarketId } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import { useArenaCredit, useArenaState, useMarketsLite } from "@masayume/markets/react";
import { useEffect, useRef, useState } from "react";
import { useVenue } from "@/features/markets";
import { LockedInMark } from "../art/PixelArt";
import { useGames } from "../GamesProvider";
import { cadenceLabel } from "../stage/SwipeDeck";
import { DUEL } from "./copy";
import type { DuelCard } from "./duel-card";
import { DuelResultModal } from "./DuelResultModal";
import { useArenaWrites } from "./useArenaWrites";

/**
 * Everything after the last swipe: the lock, the settlement as it arrives card by card, and the
 * result with whatever the arena is holding for this wallet.
 *
 * The one number this screen is about is **real PnL** — payout minus the cost the contract measured
 * around the fill — and it is never called a score. Both players' positions are their own either
 * way; the side-pot follows the comparison, and on a free duel there is no pot at all, which the
 * copy says rather than leaving a zero to be misread.
 *
 * The claim is a pull, and the arena pays the player named on it rather than the caller — so it is
 * safe to leave, and the credit does not expire while a player is away.
 */
export function DuelResult({ state, wallet }: { state: Extract<MatchState, { phase: "locked" | "settling" | "finalized" | "forfeited" }>; wallet: string | null }) {
  const { boot } = useVenue();
  const credit = useArenaCredit((wallet as Address | null) ?? null);
  const { claim, settleCard, finalize, busy, canSign } = useArenaWrites();
  const { feedback } = useGames();
  const arena = useArenaState();

  const decimals = boot && isOk(boot) ? boot.value.collateral.decimals : null;
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const money = (base: bigint | null) => (base === null || decimals === null ? DUEL.result.unsettled : formatBaseUnits(base, decimals, { maxDp: 4, minDp: 2 }));

  const you = wallet?.toLowerCase() ?? null;
  const receipts = "receipts" in state ? state.receipts : [];
  const cards = "cards" in state ? state.cards : [];
  const settled = receipts.filter((r) => r.payoutBase !== null).length;
  const total = cards.length * 2;

  const owed = credit && isOk(credit) ? credit.value : null;

  const mine = receipts.filter((r) => r.player.toLowerCase() === you);
  const theirs = receipts.filter((r) => r.player.toLowerCase() !== you);

  /**
   * Which cards the venue has already decided — one read for the whole deck, and the exact
   * precondition `settleCard` checks on chain. Offering the crank before this is true would be
   * offering a transaction that reverts and costs its gas anyway.
   */
  const lite = useMarketsLite(cards.map((c) => c.marketId as MarketId));
  const decided = (marketId: string) => {
    if (!lite || !isOk(lite)) return false;
    const market = lite.value.get(marketId as MarketId);
    return market !== undefined && (market.status === "Resolved" || market.voided);
  };
  const outstanding = cards.filter((card) => decided(card.marketId) && receipts.some((r) => r.cardIndex === card.index && r.payoutBase === null));
  const canFinalize = state.phase !== "finalized" && receipts.length > 0 && receipts.every((r) => r.payoutBase !== null);

  const outcome = state.phase === "finalized" ? state.outcome : null;
  const yourPnl = outcome && you ? (Object.entries(outcome.pnlBase).find(([addr]) => addr.toLowerCase() === you)?.[1] ?? null) : null;
  const theirPnl = outcome && you ? (Object.entries(outcome.pnlBase).find(([addr]) => addr.toLowerCase() !== you)?.[1] ?? null) : null;
  const verdict =
    outcome === null
      ? null
      : outcome.winner === null
        ? DUEL.result.tied
        : outcome.winner.toLowerCase() === you
          ? DUEL.result.won
          : DUEL.result.lost;

  // Flicky's settlement cue (`duel-view.tsx` L237–249): one per card, only on a pending→settled
  // transition seen live — never on first load, where every settled card would ring at once.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const settledNow = new Set(mine.filter((r) => r.payoutBase !== null).map((r) => r.pickKey));
    if (seen.current === null) {
      seen.current = settledNow;
      return;
    }
    for (const receipt of mine) {
      if (receipt.payoutBase === null || seen.current.has(receipt.pickKey)) continue;
      feedback(receipt.payoutBase > receipt.costBase ? "card-win" : "card-loss");
    }
    seen.current = settledNow;
  }, [mine, feedback]);

  // The verdict's own sound, once per match, as the result modal opens itself — Flicky's `duel-result-modal.tsx` L70–78; a tie takes the modal's own chirp.
  const [modalOpen, setModalOpen] = useState(false);
  const sounded = useRef<string | null>(null);
  useEffect(() => {
    if (!outcome || sounded.current === state.matchId) return;
    sounded.current = state.matchId;
    setModalOpen(true);
    feedback(outcome.winner === null ? "modal-open" : outcome.winner.toLowerCase() === you ? "duel-win" : "duel-lose");
  }, [outcome, state.matchId, you, feedback]);

  // What the modal and its share card say: the chain's figures, and the pot the tier priced.
  const tierPot = arena && isOk(arena) ? (arena.value?.tiers[STAKE_TIERS.findIndex((t) => t.id === state.tier)]?.potBase ?? null) : null;
  const costBase = mine.reduce((sum, r) => sum + r.costBase, 0n);
  const card: DuelCard | null =
    outcome && decimals !== null
      ? {
          matchId: state.matchId,
          verdict: outcome.winner === null ? "tied" : outcome.winner.toLowerCase() === you ? "won" : "lost",
          returnPct: state.tier === "free" || yourPnl === null || costBase === 0n ? null : Number((yourPnl * 100n) / costBase),
          you,
          opponent: you === null ? null : state.players.creator.toLowerCase() === you ? state.players.challenger : state.players.creator,
          hits: mine.filter((r) => r.payoutBase !== null && r.payoutBase > r.costBase).length,
          total: cards.length,
          pnlBase: yourPnl,
          potAwardedBase: tierPot === null ? null : outcome.winner === null ? tierPot : tierPot * 2n,
          free: state.tier === "free",
          decimals,
          symbol,
        }
      : null;

  return (
    <section className="du-result" aria-label={DUEL.result.title}>
      {state.phase === "locked" && (
        <div className="du-plate du-locked">
          <LockedInMark className="du-locked-mark" />
          <h2 className="du-queue-title">{DUEL.settling.lockedTitle}</h2>
          <p className="du-body">{DUEL.settling.lockedBody}</p>
        </div>
      )}

      {state.phase === "settling" && (
        <div className="du-plate">
          <div className="du-queue-head">
            <span className="du-spinner" aria-hidden />
            <h2 className="du-queue-title">{DUEL.settling.title}</h2>
          </div>
          <p className="du-v">{DUEL.settling.progress(settled, total)}</p>
          <p className="du-body">{DUEL.settling.body}</p>
        </div>
      )}

      {state.phase === "forfeited" && (
        <div className="du-plate">
          <h2 className="du-queue-title">{DUEL.result.forfeitTitle}</h2>
          <p className="du-body">{DUEL.result.forfeitBody}</p>
        </div>
      )}

      {verdict && (
        <div className={`du-verdict${outcome?.winner === null ? "" : outcome?.winner?.toLowerCase() === you ? " du-verdict--won" : " du-verdict--lost"}`}>
          <p className="du-verdict-line">{verdict}</p>
          <div className="du-facts">
            <div className="du-fact">
              <span className="du-k">
                {DUEL.result.you} · {DUEL.result.pnl}
              </span>
              <span className={`du-v ${sign(yourPnl)}`}>{signed(yourPnl, money)} {symbol}</span>
            </div>
            <div className="du-fact">
              <span className="du-k">
                {DUEL.result.opponent} · {DUEL.result.pnl}
              </span>
              <span className={`du-v ${sign(theirPnl)}`}>{signed(theirPnl, money)} {symbol}</span>
            </div>
          </div>
          <p className="du-foot">{DUEL.result.pnlNote}</p>
          <p className="du-foot">{state.tier === "free" ? DUEL.result.freePotNote : DUEL.result.potNote}</p>
          {card && !modalOpen && (
            <button type="button" className="du-quiet" onClick={() => setModalOpen(true)}>
              {DUEL.result.modal.reopen}
            </button>
          )}
        </div>
      )}
      {card && <DuelResultModal open={modalOpen} onClose={() => setModalOpen(false)} card={card} />}

      {receipts.length > 0 && (
        <div className="du-plate">
          <span className="du-k">{DUEL.result.cards}</span>
          <ul className="du-picked-list">
            {[...mine, ...theirs]
              .sort((a, b) => a.cardIndex - b.cardIndex || (a.player.toLowerCase() === you ? -1 : 1))
              .map((receipt) => (
                <Row key={receipt.pickKey} receipt={receipt} cards={cards} you={you} money={money} symbol={symbol} />
              ))}
          </ul>
        </div>
      )}

      {canSign && (outstanding.length > 0 || canFinalize) && "matchId" in state && (
        <div className="du-plate">
          <span className="du-k">{DUEL.settling.crankTitle}</span>
          <p className="du-body">{DUEL.settling.crankBody}</p>
          <div className="du-cranks">
            {outstanding.map((card) => (
              <button
                key={card.index}
                type="button"
                className="du-quiet"
                disabled={busy !== null}
                onClick={() => void settleCard(state.matchId as Bytes32, card.index)}
              >
                {busy === `settle:${card.index}` ? DUEL.settling.settling : DUEL.settling.settleCard(card.asset)}
              </button>
            ))}
            {canFinalize && (
              <button type="button" className="du-quiet" disabled={busy !== null} onClick={() => void finalize(state.matchId as Bytes32)}>
                {busy === "finalize" ? DUEL.settling.finalizing : DUEL.settling.finalize}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="du-plate">
        <span className="du-k">{DUEL.result.credit}</span>
        <p className="du-v">{owed === null ? DUEL.result.unsettled : `${money(owed)} ${symbol}`}</p>
        {owed !== null && owed > 0n && canSign && wallet && (
          <button type="button" className="du-cta" disabled={busy !== null} onClick={() => void claim(wallet as Address)}>
            {busy === "claim" ? DUEL.result.claiming : DUEL.result.claim}
          </button>
        )}
        {owed === 0n && <p className="du-body">{DUEL.result.nothingToClaim}</p>}
        <p className="du-foot">{DUEL.result.claimNote}</p>
      </div>

      {/* A deck that is complete but unsettled is the normal case: the Windows have not closed yet. */}
      {picksComplete(cards, receipts) && !everyCardSettled(cards, receipts) && state.phase !== "finalized" && (
        <p className="du-foot">{DUEL.settling.waitingCard}</p>
      )}
    </section>
  );
}

function sign(base: bigint | null): string {
  if (base === null || base === 0n) return "";
  return base > 0n ? "du-up" : "du-down";
}

function signed(base: bigint | null, money: (b: bigint | null) => string): string {
  if (base === null) return DUEL.result.unsettled;
  return `${base > 0n ? "+" : base < 0n ? "−" : ""}${money(base < 0n ? -base : base)}`;
}

function Row({
  receipt,
  cards,
  you,
  money,
  symbol,
}: {
  receipt: CardReceipt;
  cards: readonly { index: number; asset: string; intervalSec: number }[];
  you: string | null;
  money: (b: bigint | null) => string;
  symbol: string;
}) {
  const card = cards.find((c) => c.index === receipt.cardIndex);
  const pnl = cardPnl(receipt);
  const settled = receipt.payoutBase !== null;
  return (
    <li className="du-picked-row" data-settled={settled} data-won={settled && pnl !== null && pnl > 0n}>
      {settled ? <span className={`du-dot du-dot--${receipt.pick}`} aria-hidden /> : <span className="du-live-dot" aria-hidden />}
      <span className="du-v">{card?.asset ?? "—"}</span>
      <span className="du-k">{card ? cadenceLabel(card.intervalSec) : ""}</span>
      <span className="du-k">{receipt.player.toLowerCase() === you ? DUEL.result.you : DUEL.result.opponent}</span>
      <span className="du-foot">
        {DUEL.result.cost} {money(receipt.costBase)} · {DUEL.result.payout} {receipt.payoutBase === null ? DUEL.result.unsettled : money(receipt.payoutBase)} {symbol}
      </span>
      <span className={`du-foot ${sign(pnl)}`}>{pnl === null ? "" : signed(pnl, money)}</span>
    </li>
  );
}
