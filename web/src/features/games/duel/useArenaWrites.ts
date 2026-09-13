"use client";

import {
  PICK_ATTEMPT_GUARD_SEC,
  PICK_ATTEMPT_MAX,
  pickFloorRaw,
  stakeTierIndex,
  type ArenaAgentGrant,
  type ArenaIntent,
  type Pick,
  type StakeTierId,
} from "@masayume/core/games";
import { isOk } from "@masayume/core/schemas";
import { diagnosis, type Address, type Bytes32, type Diagnosis, type MarketId } from "@masayume/core/types";
import { topUpSessionGas } from "@masayume/markets";
import { quoteArenaPick, submitArenaPick, type ArenaPickOutcome } from "@masayume/markets/games";
import { invalidateAfterWrite, useSubmitter } from "@masayume/markets/react";
import { getClient } from "@masayume/markets/runtime";
import { resolveVaultDeployment, type VaultContracts } from "@masayume/markets/vault";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { PublicClient } from "viem";
import { webEnv } from "@/lib/env";
import { useWalletSession } from "@/lib/wallet-session";
import { useOwnerWalletClient } from "@/providers/UserSessionProvider";
import { useGameSession, type GameSession } from "./useGameSession";

/**
 * Every transaction a duel asks of a player: opening the match, joining it, and each pick.
 *
 * **A pick retries, and that is not defensive padding.** On a binary pool, buying UP and buying DOWN
 * draw on the same resting liquidity, so two seats swiping the same card in the same second contend
 * — the loser's fill comes back under the floor it was quoted against and the arena refuses it, as it
 * should. That is the normal case in a live duel, and it is what cost the first drive its eighth pick
 * (`context/54` §3). The stake never changes on a retry, only the floor loosens, because the arena
 * refunds whatever the walk does not spend.
 *
 * **Nothing here quotes a size the chain did not.** Every attempt re-reads `sizeForStake` immediately
 * before it sends, so a floor is always a fraction of a live quote rather than of a stale one.
 */

export type ArenaBusy = "create" | "join" | "claim" | "finalize" | "lock" | "authorize" | "fund" | `pick:${number}` | `settle:${number}` | null;

/**
 * The last transaction this screen asked for and did not get — and the reason a duel needed it.
 *
 * `create` and `join` used to be sent with `void`, so every refusal was discarded. A wallet with no STT
 * therefore pressed "open the match", watched it say "opening…", and got the same button back with
 * nothing said: the gas pre-check had refused it before the wallet was ever asked. Measured on
 * 2026-09-04 — both browsers in that session held 0 STT and not one of their three sealed decks reached
 * the chain. A write that fails silently is worse than one that fails loudly.
 */
export interface ArenaRefusal {
  key: Exclude<ArenaBusy, null>;
  diagnosis: Diagnosis;
  /** The one refusal with somewhere to go: an empty tank routes to the faucets (FR-2), never a revert. */
  gasShort: boolean;
}

export interface PickProgress {
  cardIndex: number;
  attempt: number;
  /** The last refusal, when there was one. A lost race is reported as a retry, never as a failure. */
  why?: string;
}

export function useArenaWrites() {
  const submitter = useSubmitter();
  const game = useGameSession();
  const walletClient = useOwnerWalletClient();
  const { address } = useWalletSession();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<ArenaBusy>(null);
  const [progress, setProgress] = useState<PickProgress | null>(null);
  const [refusal, setRefusal] = useState<ArenaRefusal | null>(null);

  const contracts = useCallback((): VaultContracts | null => {
    if (!walletClient) return null;
    return { walletClient, publicClient: getClient().getViemClient() as PublicClient, deployment: resolveVaultDeployment(webEnv.markets) };
  }, [walletClient]);

  const refresh = useCallback(async () => {
    if (address) await invalidateAfterWrite(queryClient, { wallet: address });
  }, [address, queryClient]);

  /**
   * One write, with its answer kept.
   *
   * Gas is checked before the wallet is asked, the same order the faucet uses: an empty tank routes the
   * player to a faucet instead of opening a prompt for a transaction that cannot be paid for. Everything
   * that is not `confirmed` lands in `refusal`, so no button can go quiet.
   */
  const send = useCallback(
    async (intent: ArenaIntent, key: Exclude<ArenaBusy, null>) => {
      if (!submitter || !address) return null;
      setBusy(key);
      setRefusal(null);
      try {
        const gas = await submitter.checkGas("arena");
        if (!gas.ok) {
          setRefusal({ key, diagnosis: gas.diagnosis, gasShort: gas.diagnosis.kind === "out-of-gas" });
          return { status: "refused", diagnosis: gas.diagnosis } as const;
        }
        const outcome = await submitter.submitTx(intent);
        if (outcome.status !== "confirmed") {
          setRefusal({ key, diagnosis: outcome.diagnosis, gasShort: outcome.diagnosis.kind === "out-of-gas" });
        }
        return outcome;
      } catch (cause) {
        const diag = diagnosis("unknown", String((cause as Error)?.message ?? cause).slice(0, 200));
        setRefusal({ key, diagnosis: diag, gasShort: false });
        return { status: "refused", diagnosis: diag } as const;
      } finally {
        setBusy(null);
        await refresh();
      }
    },
    [submitter, address, refresh],
  );

  /** The creator's transaction: the pot goes in and the sealed deck's hash goes on chain with it. */
  const create = useCallback(
    (input: { matchId: Bytes32; challenger: Address; tier: StakeTierId; deckHash: Bytes32; deckSize: number; policyVersion: number; potBase: bigint; agent?: ArenaAgentGrant }) =>
      send(
        {
          kind: "arena-create",
          matchId: input.matchId,
          challenger: input.challenger,
          tier: stakeTierIndex(input.tier),
          deckHash: input.deckHash,
          deckSize: input.deckSize,
          policyVersion: input.policyVersion,
          potBase: input.potBase,
          ...(input.agent ? { agent: input.agent } : {}),
        },
        "create",
      ),
    [send],
  );

  const join = useCallback(
    (matchId: Bytes32, potBase: bigint, agent?: ArenaAgentGrant) => send({ kind: "arena-join", matchId, potBase, ...(agent ? { agent } : {}) }, "join"),
    [send],
  );

  /** A pull, and the arena pays the player named on it rather than the caller. */
  const claim = useCallback((player: Address) => send({ kind: "arena-claim", player }, "claim"), [send]);

  /**
   * Names this browser's key for a seat after the entry did not — the way back in when the key that
   * entered is on another device, or was lost with its storage. One wallet transaction, then the key swipes.
   */
  const authorize = useCallback((matchId: Bytes32, agent: Address, ttlSec: number) => send({ kind: "arena-authorize", matchId, agent, ttlSec }, "authorize"), [send]);

  /**
   * The two permissionless cranks a player may need to run themselves.
   *
   * Doc 04's recovery list requires it: with the operator's settler unavailable, a player or anyone
   * else must be able to advance a settled card and award the pot. Neither can redirect a payout —
   * the arena credits whoever it already recorded — so the only thing the caller spends is gas.
   */
  const settleCard = useCallback(
    (matchId: Bytes32, cardIndex: number) => send({ kind: "arena-settle-card", matchId, cardIndex }, `settle:${cardIndex}`),
    [send],
  );

  const finalize = useCallback((matchId: Bytes32) => send({ kind: "arena-finalize", matchId }, "finalize"), [send]);
  /** Closes a pick window whose deadline has passed — permissionless, and the one crank a dead duel needs to end. */
  const lock = useCallback((matchId: Bytes32) => send({ kind: "arena-lock", matchId }, "lock"), [send]);

  /**
   * One card, one side, retried while the deadline allows.
   *
   * The deadline guard stops attempts a few seconds early rather than at the line: a send already in
   * flight still has to be mined, and a pick that lands after the lock is gas spent on a revert.
   *
   * With a game key in hand the pick is `placePickFor`, signed by the key and paid for by the player:
   * no wallet prompt, and the gas check is the key's own tank. Without one it is the player's own
   * `placePick`, one signature per card — the shape the first duels shipped with.
   */
  const pick = useCallback(
    async (input: { matchId: Bytes32; cardIndex: number; marketId: MarketId; side: Pick; stakeBase: bigint; deadlineSec: number }): Promise<ArenaPickOutcome> => {
      const c = contracts();
      if (!submitter || !address || !c) {
        return { status: "refused", diagnosis: diagnosis("signer-required", "this browser has no signing session bound") };
      }

      const keyed = game.session;
      const ctx = keyed ? { journal: keyed.submitter.journal, wallet: keyed.address, contracts: keyed.contracts } : { journal: submitter.journal, wallet: address, contracts: c };
      setBusy(`pick:${input.cardIndex}`);
      setRefusal(null);
      let last: ArenaPickOutcome = { status: "refused", diagnosis: diagnosis("order-expired", "the pick deadline passed before a fill landed") };

      try {
        for (let attempt = 1; attempt <= PICK_ATTEMPT_MAX; attempt += 1) {
          if (Math.floor(Date.now() / 1_000) >= input.deadlineSec - PICK_ATTEMPT_GUARD_SEC) break;
          setProgress({ cardIndex: input.cardIndex, attempt, why: attempt > 1 ? last.status : undefined });

          const quote = await quoteArenaPick(input.marketId, input.side, input.stakeBase);
          if (!isOk(quote) || !quote.value) continue;

          const floor = pickFloorRaw(quote.value.quantityRaw, attempt);
          last = await submitArenaPick(
            ctx,
            keyed
              ? { kind: "arena-pick-for", player: address, matchId: input.matchId, cardIndex: input.cardIndex, pick: input.side, stakeBase: input.stakeBase, minQuantityRaw: floor }
              : { kind: "arena-pick", matchId: input.matchId, cardIndex: input.cardIndex, pick: input.side, stakeBase: input.stakeBase, minQuantityRaw: floor },
          );
          if (last.status === "confirmed" || last.status === "unknown") return last;
          // A dry tank is not a lost race: nothing will fill until the key is funded, so say that and stop retrying.
          if (last.status === "refused" && last.diagnosis.kind === "out-of-gas") {
            setRefusal({ key: `pick:${input.cardIndex}`, diagnosis: last.diagnosis, gasShort: true });
            return last;
          }
        }
        return last;
      } finally {
        setBusy(null);
        setProgress(null);
        await refresh();
      }
    },
    [submitter, address, contracts, refresh, game.session],
  );

  /**
   * The player's own top-up of the key — one wallet transaction, the fallback when no sponsor will pay and
   * the entry's envelope has been spent. The amount is the caller's, sized off the cards still to play.
   */
  const fundKey = useCallback(
    async (amountWei: bigint) => {
      if (!walletClient || !game.key) return null;
      setBusy("fund");
      setRefusal(null);
      try {
        const hash = await topUpSessionGas({ ownerWalletClient: walletClient, key: game.key, amountWei });
        return hash;
      } catch (cause) {
        setRefusal({ key: "fund", diagnosis: diagnosis("unknown", String((cause as Error)?.message ?? cause).slice(0, 200)), gasShort: false });
        return null;
      } finally {
        setBusy(null);
        await refresh();
      }
    },
    [walletClient, game.key, refresh],
  );

  return {
    /** The key this browser swipes with, and the grant an entry names for it. */
    game: game as GameSession,
    fundKey,
    create,
    join,
    claim,
    authorize,
    settleCard,
    finalize,
    lock,
    pick,
    busy,
    progress,
    refusal,
    dismissRefusal: useCallback(() => setRefusal(null), []),
    canSign: Boolean(submitter && walletClient),
  };
}
