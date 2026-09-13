"use client";

import type { ArenaAgentGrant } from "@masayume/core/games";
import type { Address } from "@masayume/core/types";
import { createLocalStorageJournal, createSessionKeySession, keyGasBalance, nowMs, type SubmitterSession } from "@masayume/markets";
import { useCallback, useEffect, useState } from "react";
import { webEnv } from "@/lib/env";
import { useWalletSession } from "@/lib/wallet-session";
import { deckGasWei } from "./gas";
import { forgetGameKey, useGameKey } from "./useGameKey";

/**
 * The key that swipes.
 *
 * Flicky asks a player for no signature per card because every one of its transactions is sponsored.
 * The same promise is kept another way: the entry transaction names a key this browser holds as the
 * seat's agent — and sends it gas in the same call when no sponsor will — and from then on every pick is
 * `placePickFor`, signed by the key and paid for by the player under the allowance the entry took. The
 * key can place picks for one seat of one match, within the deck's own ceiling, until the grant runs out
 * — and nothing else. Losing it loses a duel's convenience, never money.
 *
 * The key itself lives in `useGameKey`, shared by every consumer; this is its signing session, under the
 * `game-session` authority so the journal names which actor sent what.
 */
/** The grant's life: a full pick window, a slow reveal before it and every crank after it. */
export const MATCH_AGENT_TTL_SEC = 6 * 3_600;

export interface GameSession {
  /** The key's address, once this browser holds one for the connected wallet. */
  key: Address | null;
  /** The key's own signing session; the picks go through it. Null until the key exists. */
  session: SubmitterSession | null;
  /**
   * What an entry names: this key, for the match's life, the deck's ceiling, and the gas it still lacks.
   * With `sponsored` the entry carries no gas at all — the sponsor tops the key up once the chain names it.
   */
  grant: (deckSize: number, perCardCapBase: bigint, sponsored?: boolean) => Promise<ArenaAgentGrant | null>;
  /** Throws the key away; the next duel makes another. */
  forget: () => Promise<void>;
}

export function useGameSession(): GameSession {
  const { address } = useWalletSession();
  const stored = useGameKey();
  const [session, setSession] = useState<SubmitterSession | null>(null);

  // The key's own session, alive only while this browser holds the key for this wallet; rebound never, disposed always.
  useEffect(() => {
    if (!stored) {
      setSession(null);
      return;
    }
    let cancelled = false;
    let created: SubmitterSession | null = null;
    void createSessionKeySession({ env: webEnv.markets, privateKey: stored.privateKey, journal: createLocalStorageJournal(nowMs), nowMs, authority: "game-session" })
      .then((next) => {
        created = next;
        if (cancelled) return next.dispose();
        setSession(next);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      });
    return () => {
      cancelled = true;
      setSession(null);
      void created?.dispose();
    };
  }, [stored]);

  const grant = useCallback(
    async (deckSize: number, perCardCapBase: bigint, sponsored = false): Promise<ArenaAgentGrant | null> => {
      if (!stored) return null;
      const budgetBase = perCardCapBase * BigInt(deckSize);
      if (sponsored) return { agent: stored.address, ttlSec: MATCH_AGENT_TTL_SEC, budgetBase, gasWei: 0n };
      const needed = deckGasWei(deckSize);
      let held = 0n;
      try {
        held = await keyGasBalance(stored.address);
      } catch {
        // An unreadable balance funds the whole envelope: over-sending stays the player's own STT, under-sending loses a card.
      }
      return { agent: stored.address, ttlSec: MATCH_AGENT_TTL_SEC, budgetBase, gasWei: held >= needed ? 0n : needed - held };
    },
    [stored],
  );

  const forget = useCallback(async () => {
    if (address) await forgetGameKey(address);
  }, [address]);

  return { key: stored?.address ?? null, session, grant, forget };
}
