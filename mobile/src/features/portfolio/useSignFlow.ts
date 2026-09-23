import { diagnosisCopy } from "@agari/core/copy";
import type { TxOutcome } from "@agari/core/ports";
import { useCallback, useState } from "react";
import { haptic, type SignPhase } from "~/components/kit";
import type { SignOutcome } from "./SignSheet";

export interface WriteResult extends SignOutcome {
  landed: boolean;
}

/** A write hook's TxOutcome in one sentence: what landed, or the diagnosis in human words. */
export function fromTx(outcome: TxOutcome | null, landed: string): WriteResult {
  if (outcome === null) return { landed: false, tone: "warn", text: "The wallet is not ready to sign yet." };
  if (outcome.status === "confirmed") return { landed: true, tone: "ok", text: landed };
  if (outcome.status === "unknown") return { landed: false, tone: "warn", text: "Waiting for the chain to answer — the write is journaled, nothing is re-sent." };
  const copy = diagnosisCopy(outcome.diagnosis.kind);
  return { landed: false, tone: "warn", text: `${copy.headline}. ${copy.body}` };
}

/** The sheet's life: open on a review, signing while the write runs, then done or failed with its sentence. */
export function useSignFlow() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<SignPhase>("review");
  const [outcome, setOutcome] = useState<SignOutcome | null>(null);

  const start = useCallback(() => {
    haptic.tap();
    setPhase("review");
    setOutcome(null);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const run = useCallback(async (write: () => Promise<WriteResult>) => {
    setPhase("signing");
    setOutcome(null);
    try {
      const result = await write();
      setOutcome({ tone: result.tone, text: result.text });
      setPhase(result.landed ? "done" : "failed");
      if (result.landed) haptic.success();
      else haptic.error();
    } catch (cause) {
      setOutcome({ tone: "warn", text: cause instanceof Error ? cause.message : String(cause) });
      setPhase("failed");
      haptic.error();
    }
  }, []);

  return { open, phase, outcome, start, close, run, setPhase };
}

/** Lets React commit the state a write hook set, so a ref to its latest return value reads the outcome, not the old render. */
export function afterCommit(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}
