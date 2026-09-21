"use client";

import type { ReserveKind } from "@agari/core/reserves";
import { invalidateAfterWrite, useSubmitter } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { diagnosisCopy } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { EARN } from "./copy";

/** What a lane write reports back: `null` once it confirmed, otherwise the sentence to show. */
export function outcomeMessage(outcome: { status: string; diagnosis?: { kind: Parameters<typeof diagnosisCopy>[0]; technical: string } }): string | null {
  if (outcome.status === "confirmed") return null;
  const copy = outcome.diagnosis ? diagnosisCopy(outcome.diagnosis.kind) : null;
  return copy ? `${copy.headline}: ${outcome.diagnosis?.technical.slice(0, 100) ?? copy.body}` : outcome.status;
}

export interface LaneRunner<B extends string> {
  busy: B | null;
  msg: string;
  setMsg: (text: string) => void;
  /** Runs one write with its key as the busy flag, and refetches every read it can change afterwards. */
  run: (key: B, body: () => Promise<string | null>) => Promise<boolean>;
}

/**
 * One busy flag, one message and one refresh for every write a supplier page sends.
 *
 * The refresh runs in `finally`, so a refused signature leaves the page reading the chain rather than the
 * optimistic figure the form was holding.
 */
export function useLaneRunner<B extends string>(): LaneRunner<B> {
  const { address } = useWalletSession();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<B | null>(null);
  const [msg, setMsg] = useState("");

  const refresh = useCallback(async () => {
    if (address) await invalidateAfterWrite(queryClient, { wallet: address });
    await queryClient.invalidateQueries({ queryKey: ["agari", "makerVault"], exact: false });
  }, [address, queryClient]);

  const run = useCallback(
    async (key: B, body: () => Promise<string | null>): Promise<boolean> => {
      setBusy(key);
      setMsg("");
      let ok = false;
      try {
        const failure = await body();
        ok = failure === null;
        setMsg(failure ?? EARN.supply.done);
      } catch (error) {
        setMsg(error instanceof Error ? error.message.slice(0, 120) : String(error));
      } finally {
        setBusy(null);
        await refresh();
      }
      return ok;
    },
    [refresh],
  );

  return { busy, msg, setMsg, run };
}

export type SupplyBusy = "supply" | "withdraw";

/** Inverse positions ride the boost reserve, so "boost" sends `agari-leverage`'s own liquidity instructions. */
const PROGRAM = { maker: "maker", range: "range", parlay: "parlay", boost: "leverage" } as const satisfies Record<ReserveKind, string>;
type HouseProgram = (typeof PROGRAM)[Exclude<ReserveKind, "maker">];

export interface ReserveWrites {
  supply: (amountBase: bigint) => Promise<boolean>;
  withdraw: (shares: bigint) => void;
  busy: SupplyBusy | null;
  msg: string;
  canSign: boolean;
}

/**
 * Supply and withdraw for one house reserve, through the session's queued lane.
 *
 * Every reserve keeps the same two liquidity instructions (`provider_supply` / `provider_withdraw`) and refuses a
 * withdrawal larger than its free capital, so the page asks for the shares that free capital covers (see
 * `supplierPosition`) and this hook only carries them to the right program. The maker vault has to settle its own
 * closed Windows before it can pay, which is `useEarnWrites`.
 */
export function useReserveWrites(kind: Exclude<ReserveKind, "maker">): ReserveWrites {
  const submitter = useSubmitter();
  const { busy, msg, run } = useLaneRunner<SupplyBusy>();
  const program: HouseProgram = PROGRAM[kind];

  const supply = useCallback(
    (amountBase: bigint): Promise<boolean> => {
      if (!submitter) return Promise.resolve(false);
      return run("supply", async () => outcomeMessage(await submitter.submitTx({ kind: `${program}-supply`, amountBase })));
    },
    [submitter, run, program],
  );

  const withdraw = useCallback(
    (shares: bigint) => {
      if (!submitter) return;
      void run("withdraw", async () => outcomeMessage(await submitter.submitTx({ kind: `${program}-withdraw`, shares })));
    },
    [submitter, run, program],
  );

  return { supply, withdraw, busy, msg, canSign: submitter !== null };
}
