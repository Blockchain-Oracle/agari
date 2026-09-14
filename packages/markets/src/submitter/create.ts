import type { AttributionHook, IntentJournal, StopGate, Submitter } from "@agari/core/ports";
import type { Address } from "@agari/core/types";
import { nowMs as chainNowMs } from "../provider/clock";
import type { Enqueue } from "../sessions/nonce-queue";
import { notDeployed } from "../stub/not-deployed";
import { noopAttribution } from "./attribution";
import { checkGas, type FeeLane, type GasCheck } from "./fees";
import { createMemoryJournal } from "./journal-memory";
import { allowAllStopGate } from "./stop-gate";

export interface SubmitterDeps {
  /** The single account this submitter signs for. */
  wallet: Address;
  /** Serialises sends so one account never races itself. */
  enqueue: Enqueue;
  stopGate?: StopGate;
  journal?: IntentJournal;
  attribution?: AttributionHook;
  nowMs?: () => number;
}

/** The core Submitter plus the pre-send checks a surface needs before it opens a wallet popup. */
export interface MarketsSubmitter extends Submitter {
  readonly journal: IntentJournal;
  readonly stopGate: StopGate;
  readonly attribution: AttributionHook;
  readonly wallet: Address;
  checkGas(lane: FeeLane): Promise<GasCheck>;
}

/**
 * Binds the two write lanes to ONE account. S1 (D-015): both lanes refuse before anything is recorded or signed,
 * with the not-deployed diagnosis, which the surfaces already render. The Solana order and tx lanes land in S4.
 */
export function createSubmitter(deps: SubmitterDeps): MarketsSubmitter {
  const { wallet, enqueue } = deps;
  const nowMs = deps.nowMs ?? chainNowMs;
  const journal = deps.journal ?? createMemoryJournal(nowMs);
  return {
    journal,
    stopGate: deps.stopGate ?? allowAllStopGate,
    attribution: deps.attribution ?? noopAttribution,
    wallet,
    hasSigner: () => true,
    submitTx: () => enqueue(async () => ({ status: "refused", diagnosis: notDeployed() }) as const),
    submitOrder: () => enqueue(async () => ({ status: "refused", diagnosis: notDeployed() }) as const),
    checkGas: (lane) => checkGas(wallet, lane),
  };
}
