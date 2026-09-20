"use client";

import { useCallback, useState } from "react";
import { signText, useOwnerWallet } from "@/lib/wallet-session";
import { readMemoryMessage, readMemoryResponseSchema, sealMemoryMessage, type SealedMemory } from "./memory-protocol";

export type MemoryReadState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "open"; memory: SealedMemory }
  /** The chain has no subscription for this wallet: the pass is the subscription, so the way in is to subscribe. */
  | { kind: "locked" }
  | { kind: "failed"; why: string };

async function post(path: string, body: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => null) };
}

/**
 * The Memory Market's two wallet flows. Both sign one of Agari's texts with the connected wallet (no transaction,
 * no fee) and send it to a route that checks the chain: the creator's signature to seal, the reader's to read.
 */
export function useSealedMemory() {
  const wallet = useOwnerWallet();
  const [reads, setReads] = useState<Record<string, MemoryReadState>>({});

  const read = useCallback(
    async (strategyId: string) => {
      if (!wallet) return;
      const set = (state: MemoryReadState) => setReads((all) => ({ ...all, [strategyId]: state }));
      set({ kind: "busy" });
      try {
        const issuedAtMs = Date.now();
        const signature = await signText(wallet, readMemoryMessage(strategyId, wallet.address, issuedAtMs));
        const { status, json } = await post("/api/strategies/memory/read", { strategyId, reader: wallet.address, issuedAtMs, signature });
        if (status === 402) return set({ kind: "locked" });
        const parsed = readMemoryResponseSchema.safeParse(json);
        if (status !== 200 || !parsed.success) return set({ kind: "failed", why: (json as { error?: string } | null)?.error ?? `status ${status}` });
        set({ kind: "open", memory: parsed.data });
      } catch (error) {
        set({ kind: "failed", why: error instanceof Error ? error.message : String(error) });
      }
    },
    [wallet],
  );

  const seal = useCallback(
    async (strategyId: string, title: string, body: string): Promise<string | null> => {
      if (!wallet) return "connect a wallet";
      try {
        const issuedAtMs = Date.now();
        const signature = await signText(wallet, sealMemoryMessage(strategyId, wallet.address, issuedAtMs, title, body));
        const { status, json } = await post("/api/strategies/memory", { strategyId, creator: wallet.address, issuedAtMs, title, body, signature });
        return status === 200 ? null : ((json as { error?: string } | null)?.error ?? `status ${status}`);
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    },
    [wallet],
  );

  return { address: wallet?.address ?? null, reads, read, seal };
}
