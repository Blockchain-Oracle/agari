"use client";

import { STAKE_TIERS, type MatchState } from "@masayume/core/games";
import { isOk } from "@masayume/core/schemas";
import type { Address, Bytes32 } from "@masayume/core/types";
import { formatBaseUnits, shortHex } from "@masayume/core/units";
import { useArenaMatch, useArenaState } from "@masayume/markets/react";
import type { CSSProperties } from "react";
import { useVenue } from "@/features/markets";
import { addressHue } from "@/lib/address-hue";
import { DUEL } from "./copy";
import { formatBaseUnits as formatWei } from "@masayume/core/units";
import { useState } from "react";
import { DealingPlate, RefusalPlate } from "./DuelWaiting";
import { useArenaWrites } from "./useArenaWrites";
import type { DealingView } from "./useDuelRoom";
import { useGameSponsor, type FundOutcome } from "./useGameSponsor";

/**
 * Between the pairing and the first swipe: an opponent, a sealed deck, and the deck opening.
 *
 * The commitment is on screen because it is the thing a player can actually check. The deck is chosen
 * and hashed before either side sees a card, the hash reaches the chain first, and `revealDeck`
 * re-derives it — so showing the hash here is not decoration, it is the receipt for "these cards were
 * fixed before you knew them".
 */
export function DuelLobby({ state, wallet, dealing }: { state: Extract<MatchState, { matchId: string }>; wallet: string | null; dealing: DealingView | null }) {
  const you = wallet?.toLowerCase() ?? null;
  const isCreator = you !== null && state.players.creator.toLowerCase() === you;
  const opponent = isCreator ? state.players.challenger : state.players.creator;

  const stage =
    state.phase === "matched"
      ? { title: DUEL.lobby.committing, body: DUEL.lobby.committingBody }
      : state.phase === "committed"
        ? { title: DUEL.lobby.committed, body: DUEL.lobby.committedBody }
        : { title: DUEL.lobby.revealing, body: DUEL.lobby.waitingPot };

  return (
    <section className="du-lobby" aria-label={DUEL.lobby.matched}>
      <div className="du-seats">
        <Seat label={DUEL.lobby.you} address={you} />
        <span className="du-versus" aria-hidden>
          vs
        </span>
        <Seat label={DUEL.lobby.opponent} address={opponent} />
      </div>
      <p className="du-seat-note">{isCreator ? DUEL.lobby.seatCreator : DUEL.lobby.seatChallenger}</p>

      <div className="du-plate">
        <div className="du-queue-head">
          <span className="du-spinner" aria-hidden />
          <h2 className="du-queue-title">{stage.title}</h2>
        </div>
        <p className="du-body">{stage.body}</p>

        {/* The room's own clock for this pairing, only while it is the thing being waited on. */}
        {state.phase === "matched" && dealing?.matchId === state.matchId && <DealingPlate dealing={dealing} />}

        {state.phase === "committed" && <OnChain state={state} isCreator={isCreator} wallet={you as Address | null} />}

        {"commitment" in state && (
          <dl className="du-facts">
            <div className="du-fact">
              <dt className="du-k">{DUEL.lobby.commitment}</dt>
              <dd className="du-v du-mono">{shortHex(state.commitment.hash, 10, 8)}</dd>
            </div>
            <div className="du-fact">
              <dt className="du-k">{DUEL.entry.tier}</dt>
              <dd className="du-v">{DUEL.lobby.cards(state.commitment.size)}</dd>
            </div>
          </dl>
        )}
      </div>
    </section>
  );
}

function Seat({ label, address }: { label: string; address: string | null }) {
  return (
    <div className="du-seat">
      <span className="du-avatar" style={{ "--du-hue": address ? addressHue(address) : 0 } as CSSProperties} aria-hidden />
      <span className="du-seat-name">
        <span className="du-k">{label}</span>
        <span className="du-mono">{address ? shortHex(address, 6, 4) : "—"}</span>
      </span>
    </div>
  );
}

/**
 * The two transactions a paired match needs from its players, and neither of them is automatic.
 *
 * The creator puts the match on chain with the sealed deck's hash; the challenger joins once it is
 * there. Both escrow, so both are a button a player presses — nothing here signs on its own, and the
 * amount named is the arena's own tier price rather than the table's.
 *
 * The challenger's button appears only when the chain says the match is `waiting`. Offering it before
 * the creation has landed would be offering a transaction that reverts.
 */
function OnChain({ state, isCreator, wallet }: { state: Extract<MatchState, { phase: "committed" }>; isCreator: boolean; wallet: Address | null }) {
  const arena = useArenaState();
  const onChain = useArenaMatch(state.matchId as Bytes32);
  const { boot } = useVenue();
  const { create, join, busy, canSign, refusal, game } = useArenaWrites();
  const sponsor = useGameSponsor();
  const [funded, setFunded] = useState<FundOutcome | null>(null);

  const tiers = arena && isOk(arena) ? arena.value?.tiers : undefined;
  const arenaTier = tiers?.[STAKE_TIERS.findIndex((t) => t.id === state.tier)];
  const potBase = arenaTier?.potBase ?? null;
  const capBase = arenaTier?.perCardCapBase ?? null;
  // The seat's key, named by this one transaction — and funded by it too, unless a sponsor is ready to
  // send the gas itself once the chain has named the key. Without a key (storage refused) the entry is
  // the plain one and every pick is a wallet signature, as the first duels were.
  const grant = () => (capBase !== null ? game.grant(state.commitment.size, capBase, sponsor.ready) : Promise.resolve(null));
  const oneSignature = game.key ? <p className="du-foot">{sponsor.ready ? DUEL.lobby.oneSignatureSponsored : DUEL.lobby.oneSignature}</p> : null;
  /** The entry confirmed: the arena now names the key, so the sponsor may fund it. Fire and forget; the stage reports a dry key on its own. */
  const afterEntry = (outcome: { status: string } | null) => {
    if (outcome?.status !== "confirmed" || !sponsor.ready || !game.key || !wallet) return;
    void sponsor.fund(state.matchId as Bytes32, wallet, game.key).then(setFunded);
  };
  const fundedNote = funded ? (
    <p className={funded.ok ? "du-foot" : "du-refusal"}>
      {funded.ok ? DUEL.lobby.sponsorFunded(formatWei(funded.amountWei, 18, { maxDp: 3, minDp: 0 })) : DUEL.lobby.sponsorDeclined(funded.error)}
    </p>
  ) : null;
  const decimals = boot && isOk(boot) ? boot.value.collateral.decimals : null;
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const pot = potBase === null || decimals === null ? "—" : formatBaseUnits(potBase, decimals, { maxDp: 2, minDp: 0 });

  const created = onChain && isOk(onChain) && onChain.value !== null;
  const { challenger } = state.players;

  if (!canSign) return <p className="du-refusal">{DUEL.lobby.noSigner}</p>;

  const refused = refusal ? <RefusalPlate diagnosis={refusal.diagnosis} gasShort={refusal.gasShort} wallet={wallet} /> : null;

  if (isCreator) {
    if (created) return <p className="du-body">{DUEL.lobby.waitingCreate}</p>;
    return (
      <>
        <p className="du-body">{DUEL.lobby.openBody(pot, symbol)}</p>
        <button
          type="button"
          className="du-cta"
          disabled={busy !== null || potBase === null || !challenger}
          onClick={() =>
            challenger &&
            potBase !== null &&
            void grant()
              .then((agent) =>
                create({
                  matchId: state.matchId as Bytes32,
                  challenger,
                  tier: state.tier,
                  deckHash: state.commitment.hash,
                  deckSize: state.commitment.size,
                  policyVersion: state.commitment.policyVersion,
                  potBase,
                  ...(agent ? { agent } : {}),
                }),
              )
              .then(afterEntry)
          }
        >
          {busy === "create" ? DUEL.lobby.opening : refusal ? DUEL.lobby.refusedRetry : DUEL.lobby.openCta}
        </button>
        {oneSignature}
        {fundedNote}
        {refused}
      </>
    );
  }

  if (!created) return <p className="du-body">{DUEL.lobby.waitingCreate}</p>;
  return (
    <>
      <p className="du-body">{DUEL.lobby.joinBody(pot, symbol)}</p>
      <button
        type="button"
        className="du-cta"
        disabled={busy !== null || potBase === null}
        onClick={() =>
          potBase !== null &&
          void grant()
            .then((agent) => join(state.matchId as Bytes32, potBase, agent ?? undefined))
            .then(afterEntry)
        }
      >
        {busy === "join" ? DUEL.lobby.joining : refusal ? DUEL.lobby.refusedRetry : DUEL.lobby.joinCta}
      </button>
      {oneSignature}
      {fundedNote}
      {refused}
    </>
  );
}
