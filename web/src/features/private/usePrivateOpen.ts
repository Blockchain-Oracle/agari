"use client";

import { formatCadence } from "@masayume/core/copy";
import { privateOpenMessage, type PrivateOpenRequest, type PrivateOpenResult } from "@masayume/core/private";
import type { Address, EventMarket, Side } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import { sizePrivateForStake } from "@masayume/markets/private";
import { invalidateAfterWrite } from "@masayume/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useSignMessage } from "wagmi";
import { diagnosisCopy } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { recordBet } from "@/features/room/record-bet";
import { upsertPrivateTicket } from "./claims-store";

/**
 * An authorisation the desk has not answered definitively yet, kept per owner across reloads. Its signature
 * is the seed of the bet's keys, so re-sending it resumes the same slot and can never charge twice; signing a
 * new one would. It stays until the desk says "opened" or "refused".
 */
const PENDING_KEY = "masayume.private.pending";

export interface PendingOpen {
  request: PrivateOpenRequest;
  asset: string;
  intervalSec: number;
}

function readPending(owner: string | null): PendingOpen | null {
  if (!owner || typeof window === "undefined") return null;
  try {
    const all = JSON.parse(window.localStorage.getItem(PENDING_KEY) ?? "{}") as Record<string, PendingOpen>;
    return all[owner.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

function writePending(owner: string, pending: PendingOpen | null): void {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(window.localStorage.getItem(PENDING_KEY) ?? "{}") as Record<string, PendingOpen>;
    if (pending) all[owner.toLowerCase()] = pending;
    else delete all[owner.toLowerCase()];
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(all));
  } catch {
    // storage unavailable — the in-memory copy still drives this session
  }
}

export interface PrivateOpenInput {
  market: EventMarket;
  /** The desk contract and its chain — the message names them so the signature opens nothing elsewhere. */
  contract: Address;
  chainId: number;
  side: Side;
  stakeBase: bigint;
  /** The guard's floor, in basis points, under the size the desk contract affords the stake — read after the signature, not from the ticket's polled quote. */
  fillFloorBps: bigint;
  symbol: string;
}

async function post(body: PrivateOpenRequest): Promise<PrivateOpenResult> {
  const res = await fetch("/api/private/open", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => null)) as (PrivateOpenResult & { error?: string }) | { error?: string } | null;
  if (!res.ok || !json || !("status" in json)) throw new Error((json && "error" in json && json.error) || `private route answered ${res.status}`);
  return json;
}

/**
 * The private open: one wallet signature over a message that names the bet, then the desk does the rest. A
 * reply that never arrived leaves the authorisation pending; the next open re-sends it instead of signing anew.
 */
export function usePrivateOpen() {
  const { signMessageAsync } = useSignMessage();
  const { address } = useWalletSession();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingOpen | null>(null);
  useEffect(() => setPending(readPending(address)), [address]);

  const send = useCallback(
    async (entry: PendingOpen): Promise<PrivateOpenResult> => {
      const owner = entry.request.owner;
      setBusy(true);
      try {
        let result: PrivateOpenResult;
        try {
          result = await post(entry.request);
        } catch (error) {
          // The route itself failed to answer: the charge may or may not have landed, so keep the authorisation.
          writePending(owner, entry);
          setPending(entry);
          throw error;
        }
        if (result.status === "unknown") {
          writePending(owner, entry);
          setPending(entry);
        } else {
          writePending(owner, null);
          setPending(null);
          if (result.status === "opened") {
            upsertPrivateTicket(result.ticket);
            // The desk holds the position, so the wallet never shows one: the registry is how the Room learns of it.
            recordBet(entry.request.marketId, owner, result.ticket.txs.mint, "private");
          }
          await invalidateAfterWrite(queryClient, { wallet: owner as Address, marketId: entry.request.marketId as EventMarket["marketId"] });
        }
        return result;
      } finally {
        setBusy(false);
      }
    },
    [queryClient],
  );

  const open = useCallback(
    async ({ market, contract, chainId, side, stakeBase, fillFloorBps, symbol }: PrivateOpenInput): Promise<PrivateOpenResult | null> => {
      if (!address) return null;
      const issuedAtMs = Date.now();
      const message = privateOpenMessage({
        owner: address,
        contract,
        chainId,
        marketId: market.marketId,
        asset: market.asset,
        cadenceText: formatCadence(market.intervalSec),
        expirySec: market.expirySec,
        side,
        stakeText: formatBaseUnits(stakeBase, market.decimals, { maxDp: market.decimals, minDp: 0, group: false }),
        symbol,
        issuedAtMs,
      });
      const signature = await signMessageAsync({ message });
      // The signature covers the stake, never the size, so the guard is taken from a sizing read now — after the
      // wallet popup — instead of the ticket's polled quote, which is up to REQUOTE_MS old before the popup even
      // opens. On a thin Window the size a stake affords moves a sixth in three seconds (measured on the 15m lane),
      // and the desk pre-flights this same read before it charges a cent.
      const sized = await sizePrivateForStake(market.marketId, side, stakeBase);
      if (!sized.ok) throw new Error(sized.error.technical || diagnosisCopy(sized.error.kind).body);
      const minQuantityRaw = (sized.value.quantityRaw * fillFloorBps) / 10_000n;
      const request: PrivateOpenRequest = { owner: address, marketId: market.marketId, side, stakeBase: stakeBase.toString(), minQuantityRaw: minQuantityRaw.toString(), issuedAtMs, signature };
      return send({ request, asset: market.asset, intervalSec: market.intervalSec });
    },
    [address, signMessageAsync, send],
  );

  /** Re-sends the pending authorisation, if any — the only way a lost reply is ever answered. */
  const resume = useCallback(async (): Promise<PrivateOpenResult | null> => {
    const entry = readPending(address) ?? pending;
    return entry ? send(entry) : null;
  }, [address, pending, send]);

  return { open, resume, pending, busy };
}
