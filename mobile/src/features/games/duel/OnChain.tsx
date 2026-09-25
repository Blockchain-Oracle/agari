import { STAKE_TIERS, type MatchState } from "@agari/core/games";
import { isOk } from "@agari/core/schemas";
import type { Address, Hash32 } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { useArenaMatch, useArenaState } from "@agari/markets/react";
import { useState } from "react";
import { DUEL } from "@/features/games/duel/copy";
import { useArenaWrites } from "@/features/games/duel/useArenaWrites";
import { useGameSponsor, type FundOutcome } from "@/features/games/duel/useGameSponsor";
import { useVenue } from "@/features/markets/useVenue";
import { Cta } from "~/features/games/frame";
import { RefusalPlate } from "./DuelWaiting";
import { Body, Foot, Refusal } from "./parts";

/**
 * web's `DuelLobby.tsx` `OnChain`: the two transactions a paired match needs, neither automatic. The creator puts
 * the match on chain with the sealed deck's hash; the challenger joins once the chain says it is waiting. Both escrow,
 * so both are a button a player presses (the wallet then asks); the amount named is the arena's own tier price.
 */
export function OnChain({ state, isCreator, wallet }: { state: Extract<MatchState, { phase: "committed" }>; isCreator: boolean; wallet: string | null }) {
  const arena = useArenaState();
  const onChain = useArenaMatch(state.matchId as Hash32);
  const { boot } = useVenue();
  const { create, join, busy, canSign, refusal, game } = useArenaWrites();
  const sponsor = useGameSponsor();
  const [funded, setFunded] = useState<FundOutcome | null>(null);

  const tiers = arena && isOk(arena) ? arena.value?.tiers : undefined;
  const arenaTier = tiers?.[STAKE_TIERS.findIndex((t) => t.id === state.tier)];
  const potBase = arenaTier?.potBase ?? null;
  const capBase = arenaTier?.perCardCapBase ?? null;
  const decimals = boot && isOk(boot) ? boot.value.collateral.decimals : null;
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const money = (base: bigint | null) => (base === null || decimals === null ? "—" : formatBaseUnits(base, decimals, { maxDp: 2, minDp: 0 }));
  const pot = money(potBase);
  const created = onChain !== null && isOk(onChain) && onChain.value !== null;
  const { challenger } = state.players;
  const size = state.commitment.size;

  const grant = () => (capBase !== null ? game.grant(size, capBase, sponsor.ready) : Promise.resolve(null));
  const afterEntry = (outcome: { status: string } | null) => {
    if (outcome?.status !== "confirmed" || !sponsor.ready || !game.key || !wallet) return;
    void sponsor.fund(state.matchId as Hash32, wallet as Address, game.key).then(setFunded);
  };

  if (!canSign) return <Refusal>{DUEL.lobby.noSigner}</Refusal>;
  if (isCreator && created) return <Body>{DUEL.lobby.waitingCreate}</Body>;
  if (!isCreator && !created) return <Body>{DUEL.lobby.waitingCreate}</Body>;

  const key = isCreator ? "create" : "join";
  const send = () => {
    if (potBase === null) return;
    void grant()
      .then((agent) => {
        if (isCreator) {
          if (!challenger) return null;
          return create({
            matchId: state.matchId as Hash32,
            challenger,
            tier: state.tier,
            deckHash: state.commitment.hash,
            deckSize: size,
            policyVersion: state.commitment.policyVersion,
            potBase,
            ...(agent ? { agent } : {}),
          });
        }
        return join(state.matchId as Hash32, potBase, agent ?? undefined);
      })
      .then(afterEntry);
  };

  const body = isCreator ? DUEL.lobby.openBody(pot, symbol) : DUEL.lobby.joinBody(pot, symbol);
  const cta = busy === key ? (isCreator ? DUEL.lobby.opening : DUEL.lobby.joining) : refusal ? DUEL.lobby.refusedRetry : isCreator ? DUEL.lobby.openCta : DUEL.lobby.joinCta;

  return (
    <>
      <Body>{body}</Body>
      <Cta label={cta} disabled={busy !== null || potBase === null || (isCreator && !challenger)} onPress={send} />
      {game.key ? <Foot>{sponsor.ready ? DUEL.lobby.oneSignatureSponsored : DUEL.lobby.oneSignature}</Foot> : null}
      {funded ? (
        funded.ok ? (
          <Foot>{DUEL.lobby.sponsorFunded(formatBaseUnits(funded.amountWei, 9, { maxDp: 6, minDp: 0 }))}</Foot>
        ) : (
          <Refusal>{DUEL.lobby.sponsorDeclined(funded.error)}</Refusal>
        )
      ) : null}
      {refusal ? <RefusalPlate diagnosis={refusal.diagnosis} gasShort={refusal.gasShort} wallet={wallet as Address | null} /> : null}
    </>
  );
}
