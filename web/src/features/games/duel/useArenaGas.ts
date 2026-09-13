"use client";

import type { Diagnosis } from "@masayume/core/types";
import { useSubmitter } from "@masayume/markets/react";
import { useCallback, useEffect, useState } from "react";
import { useWalletSession } from "@/lib/wallet-session";

/**
 * Whether this wallet can pay for the transactions a duel is about to ask of it.
 *
 * Asked at the entry rather than at the first button, because a duel is not a screen a player can back
 * out of politely: by the time "open the match" refuses, an opponent has been paired, a deck has been
 * sealed and the venue's Windows have been spent on a match nobody can create. On 2026-09-04 two
 * browsers holding 0 STT queued, paired and sealed three decks between them, and not one reached the
 * chain — the entry had never asked.
 *
 * It uses the submitter's own `checkGas` against the `arena` lane, so the number it compares against is
 * the same envelope the write lane will refuse on, rather than a second guess at it.
 */

export type ArenaGas =
  | { kind: "unknown" }
  | { kind: "checking" }
  | { kind: "ok" }
  | { kind: "short"; diagnosis: Diagnosis };

export function useArenaGas(): { gas: ArenaGas; recheck: () => Promise<void> } {
  const submitter = useSubmitter();
  const { address } = useWalletSession();
  const [gas, setGas] = useState<ArenaGas>({ kind: "unknown" });

  const recheck = useCallback(async () => {
    if (!submitter || !address) {
      setGas({ kind: "unknown" });
      return;
    }
    setGas({ kind: "checking" });
    const check = await submitter.checkGas("arena");
    // Only an empty tank is reported as short. An unreadable RPC is not a claim about a balance, and
    // blocking the entry on one would refuse a duel because a node blinked.
    setGas(check.ok ? { kind: "ok" } : check.diagnosis.kind === "out-of-gas" ? { kind: "short", diagnosis: check.diagnosis } : { kind: "unknown" });
  }, [submitter, address]);

  useEffect(() => {
    void recheck();
  }, [recheck]);

  return { gas, recheck };
}
