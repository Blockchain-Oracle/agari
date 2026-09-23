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
} from "@agari/core/games";
import { isOk } from "@agari/core/schemas";
import type { Address, Hash32 } from "@agari/core/types";
import { quoteArenaPick } from "@agari/markets/games";
import { useArenaState } from "@agari/markets/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNowMs } from "@/components/data/useNowMs";
import { DUEL } from "@/features/games/duel/copy";
import { deckFeeLamports } from "@/features/games/duel/gas";
import { useArenaOdds } from "@/features/games/duel/useArenaOdds";
import { useArenaWrites } from "@/features/games/duel/useArenaWrites";
import type { DuelRoom } from "@/features/games/duel/useDuelRoom";
import { useGameSponsor, type FundOutcome } from "@/features/games/duel/useGameSponsor";
import { webEnv } from "@/lib/env";
import { useVenue } from "@/features/markets/useVenue";

/**
 * web's `DuelPicking.tsx` logic, unchanged, lifted into a hook so the native view stays a view: a card is gated on
 * the arena's rule (`cardPlayable`), the countdown is the earlier of the pick window and the soonest card's usable
 * life, a lost race is a retry inside the write lane, a card left unswiped into its last seconds is played by the key
 * on the favoured side (Flicky's auto-swipe), and a dead window names the permissionless lock.
 */
const AUTO_SWIPE_LEAD_SEC = 15;
const OPPONENT_CUE_MS = 8_000;

export function usePicking(state: Extract<MatchState, { phase: "picking" }>, wallet: string | null, room: DuelRoom) {
  const nowMs = useNowMs();
  const arena = useArenaState();
  const { boot } = useVenue();
  const writes = useArenaWrites();
  const { pick, fundKey, busy, canSign, refusal, game } = writes;
  const sponsor = useGameSponsor();
  const [failed, setFailed] = useState<number | null>(null);
  const [keyDry, setKeyDry] = useState<boolean | null>(null);
  const [asked, setAsked] = useState<FundOutcome | null>(null);
  const [autoPlayed, setAutoPlayed] = useState<readonly number[]>([]);
  const autoRef = useRef<string | null>(null);
  const keyed = game.session !== null;

  const you = wallet;
  const params = arena && isOk(arena) ? arena.value?.params : undefined;
  const decimals = boot && isOk(boot) ? boot.value.collateral.decimals : null;
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const stakeBase = arena && isOk(arena) ? (arena.value?.tiers[STAKE_TIERS.findIndex((t) => t.id === state.tier)]?.perCardCapBase ?? null) : null;

  const mine = useMemo(() => state.receipts.filter((r) => r.player === you), [state.receipts, you]);
  const playedSide = useCallback((cardIndex: number) => mine.find((r) => r.cardIndex === cardIndex)?.pick ?? null, [mine]);
  const active = state.cards.find((card) => !mine.some((r) => r.cardIndex === card.index)) ?? null;

  const nowSec = Math.floor((nowMs || Date.now()) / 1_000);
  const endsSec = params ? pickWindowEndsSec(state.cards, params, Math.floor(state.deadlineMs / 1_000)) : Math.floor(state.deadlineMs / 1_000);
  const leftSec = Math.max(0, endsSec - nowSec);
  const playable = active !== null && params !== undefined && cardPlayable(active, params, nowSec);
  const seat = you !== null && state.players.creator === you ? SEAT_CREATOR : SEAT_CHALLENGER;

  const onPick = useCallback(
    (card: DeckCard, side: Pick) => {
      if (stakeBase === null || !canSign) return;
      setFailed(null);
      // Advisory only, and without the side: the opponent learns that you are on this card.
      room.send({ type: "pick.pending", matchId: state.matchId, cardIndex: card.index });
      void pick({ matchId: state.matchId as Hash32, cardIndex: card.index, marketId: card.marketId, side, stakeBase, deadlineSec: endsSec }).then((outcome) => {
        if (outcome.status !== "confirmed" && outcome.status !== "unknown") {
          setFailed(card.index);
          return;
        }
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

  const odds = useArenaOdds(active?.marketId ?? null, stakeBase, decimals);
  const dry = keyed && (keyDry === true || refusal?.gasShort === true);
  const held = !canSign ? DUEL.lobby.noSigner : dry ? DUEL.picking.keyGasShort : active && params && !playable ? DUEL.picking.tooLate : null;
  const topUpLamports = deckFeeLamports(Math.max(1, state.cards.length - mine.length));

  const askSponsor = () => {
    if (!game.key || !you) return;
    setAsked(null);
    void sponsor.fund(state.matchId as Hash32, you as Address, game.key).then((outcome) => {
      setAsked(outcome);
      if (outcome.ok) setKeyDry(false);
    });
  };
  const fundFromWallet = () => {
    setAsked(null);
    void fundKey(topUpLamports).then((hash) => hash && setKeyDry(false));
  };

  const lastAuto = autoPlayed.length > 0 ? mine.find((r) => r.cardIndex === autoPlayed[autoPlayed.length - 1]) : undefined;
  const opponentHere =
    room.opponentPending !== null && active !== null && room.opponentPending.cardIndex === active.index && nowMs - room.opponentPending.atMs < OPPONENT_CUE_MS;
  const windowSec = params?.pickWindowSec ?? 0;
  const depleted = windowSec > 0 ? Math.max(0, Math.min(1, leftSec / windowSec)) : 0;
  const opponentAddress = you === null ? null : state.players.creator === you ? state.players.challenger : state.players.creator;
  const opponentAway = opponentAddress !== null && room.presence.some((row) => row.wallet === opponentAddress && !row.online);
  const opponentUnfinished = opponentAddress !== null && state.receipts.filter((r) => r.player === opponentAddress).length < state.cards.length;
  const dead = nowSec > 0 && leftSec === 0 && (active !== null || opponentUnfinished);
  const opponentPicks = opponentAddress === null ? 0 : state.receipts.filter((r) => r.player === opponentAddress).length;

  return {
    writes,
    nowMs,
    decimals,
    symbol,
    stakeBase,
    mine,
    playedSide,
    active,
    leftSec,
    depleted,
    onPick,
    odds,
    held,
    dry,
    failed,
    keyed,
    asked,
    askSponsor,
    fundFromWallet,
    topUpLamports,
    sponsorConfigured: sponsor.status?.configured === true,
    autoPlayed,
    lastAuto,
    opponentHere,
    opponentAway,
    opponentUnfinished,
    opponentPicks,
    dead,
  };
}
