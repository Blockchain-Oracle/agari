"use client";

import type { MarketId } from "@agari/core/types";
import { getMakerUnsettledExpired } from "@agari/markets/maker";
import { useSubmitter } from "@agari/markets/react";
import { useCallback } from "react";
import { EARN } from "./copy";
import { outcomeMessage, useLaneRunner } from "./useReserveWrites";

export type EarnBusy = "supply" | "withdraw" | `merge:${string}` | `settle:${string}`;

/** The vault caps its open Windows (`maxOpenWindows`); this is the most settles one exit will send before giving up. */
const MAX_SETTLES_BEFORE_WITHDRAW = 16;

/** Every maker vault write from the page through the session's lane; every read the write can change is refetched afterwards. */
export function useEarnWrites() {
  const submitter = useSubmitter();
  const { busy, msg, setMsg, run } = useLaneRunner<EarnBusy>();

  const supply = useCallback(
    (amountBase: bigint): Promise<boolean> => {
      if (!submitter) return Promise.resolve(false);
      return run("supply", async () => outcomeMessage(await submitter.submitTx({ kind: "maker-supply", amountBase })));
    },
    [submitter, run],
  );

  /**
   * Settles every closed Window that blocks the exit (anyone may), then redeems the shares. The vault names the
   * blockers one at a time, so this asks again after each settle — a first cut settled one and the withdraw was
   * refused on the next (four were closed at once, context/49).
   */
  const withdraw = useCallback(
    (shares: bigint) => {
      if (!submitter) return;
      void run("withdraw", async () => {
        for (let round = 0; round < MAX_SETTLES_BEFORE_WITHDRAW; round += 1) {
          const stale = await getMakerUnsettledExpired();
          if (!stale.ok || !stale.value) break;
          setMsg(EARN.position.settling);
          const failure = outcomeMessage(await submitter.submitTx({ kind: "maker-settle", marketId: stale.value }));
          if (failure) return failure;
        }
        return outcomeMessage(await submitter.submitTx({ kind: "maker-withdraw", shares }));
      });
    },
    [submitter, run, setMsg],
  );

  const merge = useCallback(
    (marketId: MarketId) => {
      if (!submitter) return;
      void run(`merge:${marketId}`, async () => outcomeMessage(await submitter.submitTx({ kind: "maker-merge", marketId })));
    },
    [submitter, run],
  );

  const settle = useCallback(
    (marketId: MarketId) => {
      if (!submitter) return;
      void run(`settle:${marketId}`, async () => outcomeMessage(await submitter.submitTx({ kind: "maker-settle", marketId })));
    },
    [submitter, run],
  );

  return { supply, withdraw, merge, settle, busy, msg, canSign: submitter !== null };
}
