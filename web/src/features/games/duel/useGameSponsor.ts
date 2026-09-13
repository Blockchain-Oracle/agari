"use client";

import type { Address, Bytes32, Hex } from "@masayume/core/types";
import { useCallback, useEffect, useState } from "react";
import { deviceId } from "@/features/session/store";

const ENDPOINT = "/api/games/sponsor";

export interface GameSponsorStatus {
  configured: boolean;
  sponsor: Address | null;
  balanceWei: bigint | null;
  capWei: bigint;
  deckEnvelopeWei: bigint;
  /** Configured and holding enough to fund a couple of decks — the entry may then send its key no gas. */
  ready: boolean;
}

export type FundOutcome = { ok: true; hash: Hex | null; amountWei: bigint; why: string } | { ok: false; error: string };

export interface GameSponsor {
  /** Null until the route has answered. */
  status: GameSponsorStatus | null;
  /** True only when the sponsor exists and can pay right now: the entry's payer decision. */
  ready: boolean;
  /** Asks the sponsor to fund one seat's key, once the arena has named it for `player`. Never throws. */
  fund: (matchId: Bytes32, player: Address, agent: Address) => Promise<FundOutcome>;
  refresh: () => void;
}

/**
 * Whether this deployment's sponsor pays the picks' gas, asked before the entry is signed — doc 04's
 * "show payer/fallback before asking for a signature" — and the one call that has it pay.
 */
export function useGameSponsor(): GameSponsor {
  const [status, setStatus] = useState<GameSponsorStatus | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(ENDPOINT)
      .then((r) => r.json() as Promise<{ configured: boolean; sponsor: Address | null; balanceWei: string | null; capWei: string; deckEnvelopeWei: string; ready: boolean }>)
      .then((wire) => {
        if (cancelled) return;
        setStatus({
          configured: wire.configured,
          sponsor: wire.sponsor,
          balanceWei: wire.balanceWei === null ? null : BigInt(wire.balanceWei),
          capWei: BigInt(wire.capWei),
          deckEnvelopeWei: BigInt(wire.deckEnvelopeWei),
          ready: wire.ready,
        });
      })
      .catch(() => {
        // An unreachable route is an absent sponsor: the entry funds the key, as it always could.
        if (!cancelled) setStatus({ configured: false, sponsor: null, balanceWei: null, capWei: 0n, deckEnvelopeWei: 0n, ready: false });
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const fund = useCallback(async (matchId: Bytes32, player: Address, agent: Address): Promise<FundOutcome> => {
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", "x-masayume-device": deviceId() },
        body: JSON.stringify({ matchId, player, agent }),
      });
      const body = (await response.json().catch(() => ({}))) as { hash?: Hex | null; amountWei?: string; why?: string; error?: string };
      if (!response.ok) return { ok: false, error: body.error ?? `the sponsor answered ${response.status}` };
      return { ok: true, hash: body.hash ?? null, amountWei: BigInt(body.amountWei ?? "0"), why: body.why ?? "" };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }, []);

  return { status, ready: status?.ready ?? false, fund, refresh: useCallback(() => setNonce((n) => n + 1), []) };
}
