"use client";

import {
  SEAT_CHALLENGER,
  SEAT_CREATOR,
  STAKE_TIERS,
  arenaPickKey,
  cardPlayable,
  pickWindowEndsSec,
  type DeckCard,
  type MatchState,
  type Pick,
} from "@masayume/core/games";
import { isOk } from "@masayume/core/schemas";
import type { Address, Bytes32 } from "@masayume/core/types";
import { formatBaseUnits, formatOracleRaw } from "@masayume/core/units";
import { keyGasBalance, requiredGasWei } from "@masayume/markets";
import { quoteArenaPick } from "@masayume/markets/games";
import { useArenaState, useAssetPrice, useOpeningPrice } from "@masayume/markets/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNowMs } from "@/components/data";
import { useVenue } from "@/features/markets";
import { ORACLE_SCALE } from "@/features/markets/hero/units";
import { webEnv } from "@/lib/env";
import { clockUrgency, StageFace } from "../stage/StageFace";
import { SwipeDeck, type DeckPlace } from "../stage/SwipeDeck";
import { DUEL } from "./copy";
import { deckGasWei } from "./gas";
import { useArenaOdds } from "./useArenaOdds";
import { useArenaWrites } from "./useArenaWrites";
import type { DuelRoom } from "./useDuelRoom";
import { useGameSponsor, type FundOutcome } from "./useGameSponsor";

/**
 * A card's own cutoff is the earlier of the pick window and the arena's floor on its life; this long
 * before it, a card nobody has swiped is played by the key on the favoured side — Flicky's auto-swipe
 * (`active-duel.tsx` L504–549), which fires at the deadline because its transactions are buffered
 * server-side; ours have no such buffer, so the lead is the buffer.
 */
const AUTO_SWIPE_LEAD_SEC = 15;

/**
 * The swipe, with money behind it.
 *
 * Same `SwipeDeck` as Practice, so the motion a player learned there is the motion here. Three
 * things it adds, and each of them is a finding from the first live duel rather than a design idea:
 *
 * **A card is gated on the arena's rule, never on ours.** `phase()` calls a Window unenterable for
 * its last 300 seconds; the arena's own floor is `minCardLifeSec`, 240 at the deployed parameters.
 * Gating on ours would refuse swipes the chain would have taken — measured at 278 seconds of card
 * life, where our buffer said no and the arena quoted 11,000 raw (`context/54` §4).
 *
 * **The countdown is the earlier of two clocks.** The pick window can legally outrun the soonest
 * card's usable life, so showing the arena's `pickDeadlineSec` alone would promise seconds that are
 * already refusable.
 *
 * **A lost race is not a failure.** Both seats draw on the same book; the retry lives in the write
 * lane and the stage says what it is doing, so a player sees "asking again", not an error.
 */
export function DuelPicking({ state, wallet, room }: { state: Extract<MatchState, { phase: "picking" }>; wallet: string | null; room: DuelRoom }) {
  const nowMs = useNowMs();
  const arena = useArenaState();
  const { boot } = useVenue();
  const { pick, lock, fundKey, progress, busy, canSign, refusal, game } = useArenaWrites();
  const sponsor = useGameSponsor();
  const [failed, setFailed] = useState<number | null>(null);
  /** The key's own tank, read before a throw rather than discovered by one; null until read. */
  const [keyDry, setKeyDry] = useState<boolean | null>(null);
  const [asked, setAsked] = useState<FundOutcome | null>(null);
  /** Cards the key played at their cutoff, so the list can say so — the chain records a pick, not who chose it. */
  const [autoPlayed, setAutoPlayed] = useState<readonly number[]>([]);
  const autoRef = useRef<string | null>(null);
  const keyed = game.session !== null;

  const you = wallet?.toLowerCase() ?? null;
  const params = arena && isOk(arena) ? arena.value?.params : undefined;
  const decimals = boot && isOk(boot) ? boot.value.collateral.decimals : null;
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";

  // The stake is the tier's own per-card cap, the same for both seats. A duel compares real PnL, so
  // letting one player stake ten times the other would make the pot a bet on size, not on calls.
  const stakeBase = arena && isOk(arena) ? (arena.value?.tiers[STAKE_TIERS.findIndex((t) => t.id === state.tier)]?.perCardCapBase ?? null) : null;

  const mine = useMemo(() => state.receipts.filter((r) => r.player.toLowerCase() === you), [state.receipts, you]);
  const playedSide = useCallback((cardIndex: number) => mine.find((r) => r.cardIndex === cardIndex)?.pick ?? null, [mine]);
  const active = state.cards.find((card) => !mine.some((r) => r.cardIndex === card.index)) ?? null;

  const nowSec = Math.floor((nowMs || Date.now()) / 1_000);
  const endsSec = params ? pickWindowEndsSec(state.cards, params, Math.floor(state.deadlineMs / 1_000)) : Math.floor(state.deadlineMs / 1_000);
  const leftSec = Math.max(0, endsSec - nowSec);
  const playable = active !== null && params !== undefined && cardPlayable(active, params, nowSec);

  const seat = you !== null && state.players.creator.toLowerCase() === you ? SEAT_CREATOR : SEAT_CHALLENGER;

  const onPick = useCallback(
    (card: DeckCard, side: Pick) => {
      if (stakeBase === null || !canSign) return;
      setFailed(null);
      // Advisory only, and without the side: the opponent learns that you are on this card.
      room.send({ type: "pick.pending", matchId: state.matchId, cardIndex: card.index });
      void pick({ matchId: state.matchId as Bytes32, cardIndex: card.index, marketId: card.marketId, side, stakeBase, deadlineSec: endsSec }).then((outcome) => {
        if (outcome.status !== "confirmed" && outcome.status !== "unknown") {
          setFailed(card.index);
          return;
        }
        // The receipt this browser just earned advances the deck now; the projector's copy of the same
        // pick lands on the same key seconds later and replaces it.
        if (outcome.status === "confirmed" && you) {
          room.recordPick({
            cardIndex: card.index,
            player: you as Address,
            pick: side,
            quantity: outcome.quantity,
            costBase: outcome.costBase,
            payoutBase: null,
            pickKey: arenaPickKey(webEnv.markets.chainId, state.matchId, card.index, seat),
          });
        }
      });
    },
    [pick, room, state.matchId, stakeBase, endsSec, canSign, you, seat],
  );

  // Flicky's auto-swipe, through the key only: a card left unswiped into its last seconds is played on
  // the side the book prices above even money, once per card, and marked as played for the player.
  useEffect(() => {
    if (!active || !params || stakeBase === null || decimals === null || !canSign || !keyed || busy !== null || failed === active.index) return;
    const cutoffSec = Math.min(endsSec, active.expirySec - params.minCardLifeSec);
    if (nowSec < cutoffSec - AUTO_SWIPE_LEAD_SEC || nowSec >= cutoffSec) return;
    const key = `${state.matchId}:${active.index}`;
    if (autoRef.current === key) return;
    autoRef.current = key;
    const card = active;
    void quoteArenaPick(card.marketId, "up", stakeBase).then((up) => {
      const one = 10n ** BigInt(decimals);
      const favoured: Pick = isOk(up) && up.value !== null && up.value.priceRaw * 2n >= one ? "up" : "down";
      setAutoPlayed((held) => [...held, card.index]);
      onPick(card, favoured);
    });
  }, [active, params, stakeBase, decimals, canSign, keyed, busy, failed, endsSec, nowSec, state.matchId, onPick]);

  const money = (base: bigint | null) => (base === null || decimals === null ? "—" : formatBaseUnits(base, decimals, { maxDp: 2, minDp: 0 }));

  const renderFace = useCallback(
    (card: DeckCard, place: DeckPlace) => <DuelFace card={card} place={place} nowMs={nowMs || undefined} stake={`${money(stakeBase)} ${symbol}`} />,
    [nowMs, stakeBase, symbol, decimals],
  );
  // The active card's two quotes, read where the deck can refuse a throw on them rather than after the chain has.
  const odds = useArenaOdds(active?.marketId ?? null, stakeBase, decimals);

  /**
   * The key's tank, checked on its own clock. A dry key used to be found out by the first throw, which
   * read as a lost race; now the stage says so before a card is played, and clears the moment a sponsor's
   * or the wallet's top-up lands.
   */
  const keyAddress = game.key;
  useEffect(() => {
    if (!keyed || !keyAddress) return;
    let alive = true;
    const read = () =>
      keyGasBalance(keyAddress)
        .then((held) => alive && setKeyDry(held < requiredGasWei("arena")))
        .catch(() => undefined);
    void read();
    const timer = setInterval(() => void read(), 8_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [keyed, keyAddress]);

  const dry = keyed && (keyDry === true || refusal?.gasShort === true);
  const held = !canSign ? DUEL.lobby.noSigner : dry ? DUEL.picking.keyGasShort : active && params && !playable ? DUEL.picking.tooLate : null;
  const cardsLeft = Math.max(1, state.cards.length - mine.length);
  const topUpWei = deckGasWei(cardsLeft);
  const askSponsor = () => {
    if (!keyAddress || !you) return;
    setAsked(null);
    void sponsor.fund(state.matchId as Bytes32, you as Address, keyAddress).then((outcome) => {
      setAsked(outcome);
      if (outcome.ok) setKeyDry(false);
    });
  };
  const fundFromWallet = () => {
    setAsked(null);
    void fundKey(topUpWei).then((hash) => hash && setKeyDry(false));
  };
  const lastAuto = autoPlayed.length > 0 ? mine.find((r) => r.cardIndex === autoPlayed[autoPlayed.length - 1]) : undefined;

  /** The opponent's cue only means anything while it is fresh; a stale one is a lie about presence. */
  const OPPONENT_CUE_MS = 8_000;
  const opponentHere =
    room.opponentPending !== null && active !== null && room.opponentPending.cardIndex === active.index && nowMs - room.opponentPending.atMs < OPPONENT_CUE_MS;

  // Flicky's depletion bar: the pick window draining full-width, a second at a time, in the clock's own colour.
  const windowSec = params?.pickWindowSec ?? 0;
  const depleted = windowSec > 0 ? Math.max(0, Math.min(100, (leftSec / windowSec) * 100)) : 0;
  const urgency = clockUrgency(leftSec);

  // Flicky's dead-duel detection (`duel-view.tsx` L383–428): once the window has closed, stop pretending a
  // settlement is coming and name the way out — here the arena's own permissionless lock, which forfeits
  // the seat that never finished or refunds both.
  const opponentAddress = you === null ? null : state.players.creator.toLowerCase() === you ? state.players.challenger : state.players.creator;
  const opponentAway = opponentAddress !== null && room.presence.some((row) => row.wallet.toLowerCase() === opponentAddress.toLowerCase() && !row.online);
  const opponentUnfinished = opponentAddress !== null && state.receipts.filter((r) => r.player.toLowerCase() === opponentAddress.toLowerCase()).length < state.cards.length;
  const dead = nowSec > 0 && leftSec === 0 && (active !== null || opponentUnfinished);

  if (dead) {
    return (
      <section className="du-picking" aria-label={DUEL.picking.title}>
        <div className="du-plate">
          <h2 className="du-queue-title">{DUEL.picking.deadTitle}</h2>
          <p className="du-body">{active !== null && opponentUnfinished ? DUEL.picking.deadBoth : active !== null ? DUEL.picking.deadYou : DUEL.picking.deadOpponent}</p>
          <p className="du-foot">{DUEL.picking.deadNote}</p>
          {canSign && (
            <button type="button" className="du-cta" disabled={busy !== null} onClick={() => void lock(state.matchId as Bytes32)}>
              {busy === "lock" ? DUEL.picking.locking : DUEL.picking.lockCta}
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="du-picking" aria-label={DUEL.picking.title}>
      {opponentAway && (
        <p className="du-pending" role="status">
          <span className="du-pending-dot" aria-hidden />
          {DUEL.picking.opponentAway}
        </p>
      )}
      <div className="st-deplete" aria-hidden>
        <span className="st-deplete-fill" data-urgency={urgency.level} data-pulse={urgency.pulse || undefined} style={{ width: `${depleted}%` }} />
      </div>
      {dry && (
        <div className="du-refusal" role="status">
          <p className="du-body">{DUEL.picking.keyGasShortWhy}</p>
          <div className="du-cranks">
            {sponsor.status?.configured && (
              <button type="button" className="du-quiet" disabled={busy !== null} onClick={askSponsor}>
                {DUEL.picking.askSponsor}
              </button>
            )}
            <button type="button" className="du-quiet" disabled={busy !== null} onClick={fundFromWallet}>
              {busy === "fund" ? DUEL.picking.funding : DUEL.picking.fundKey(formatBaseUnits(topUpWei, 18, { maxDp: 3, minDp: 0 }))}
            </button>
          </div>
          {asked && <p className="du-foot">{asked.ok ? DUEL.lobby.sponsorFunded(formatBaseUnits(asked.amountWei, 18, { maxDp: 3, minDp: 0 })) : DUEL.lobby.sponsorDeclined(asked.error)}</p>}
        </div>
      )}
      <SwipeDeck
        cards={state.cards}
        active={active}
        playedSide={playedSide}
        onPick={onPick}
        busy={busy !== null}
        refusal={held}
        odds={odds}
        renderFace={renderFace}
        hint={
          <p className="st-hint">
            {progress
              ? DUEL.picking.placing(progress.attempt)
              : failed !== null
                ? DUEL.picking.failed
                : lastAuto
                  ? DUEL.picking.autoNote(lastAuto.pick)
                  : keyed
                    ? DUEL.picking.keySwipes
                    : DUEL.picking.raceNote}
          </p>
        }
      />

      {opponentHere && (
        <p className="du-pending" role="status">
          <span className="du-pending-dot" aria-hidden />
          {DUEL.picking.opponentDeciding}
        </p>
      )}

      {mine.length > 0 && (
        <div className="du-picked">
          <span className="du-k">{DUEL.picking.yourPicks}</span>
          <ul className="du-picked-list">
            {mine
              .slice()
              .sort((a, b) => a.cardIndex - b.cardIndex)
              .map((receipt) => {
                const card = state.cards.find((c) => c.index === receipt.cardIndex);
                return (
                  <li key={receipt.pickKey} className="du-picked-row">
                    <span className={`du-dot du-dot--${receipt.pick}`} aria-hidden />
                    <span className="du-v">{card?.asset ?? "—"}</span>
                    <span className="du-k">{receipt.pick}</span>
                    <span className="du-foot">
                      {DUEL.picking.filled(receipt.quantity.toString(), money(receipt.costBase), symbol)}
                      {autoPlayed.includes(receipt.cardIndex) ? ` · ${DUEL.picking.autoPlayed}` : ""}
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </section>
  );
}


/** Whole dollars, grouped — the reference's `usd0`. */
const usd0 = (raw: bigint): string => `$${formatOracleRaw(raw, ORACLE_SCALE, 0)}`;

/**
 * The duel's face on the five bands: the Window's line as the question — the oracle's opening print,
 * which is what the Window settles against — the live price as `now`, and the tier's per-card stake.
 * Its own component because the line and the price are reads, and a read is a hook.
 */
function DuelFace({ card, place, nowMs, stake }: { card: DeckCard; place: DeckPlace; nowMs: number | undefined; stake: string }) {
  const opening = useOpeningPrice(card.marketId);
  const lineRaw = opening?.ok ? opening.value : null;
  const price = useAssetPrice(card.asset);
  const spot = price?.ok ? price.value : null;
  return (
    <StageFace
      card={card}
      place={place}
      nowMs={nowMs}
      eyebrow={DUEL.picking.eyebrow(card.asset)}
      question={lineRaw === null ? <span className="st-question-pending">{DUEL.picking.questionNoLine}</span> : DUEL.picking.question(usd0(lineRaw))}
      pills={[
        { label: DUEL.picking.now, value: spot ? usd0(spot.priceRaw) : "—", tone: "live" },
        { label: DUEL.picking.stake, value: stake, tone: "up" },
      ]}
    />
  );
}
