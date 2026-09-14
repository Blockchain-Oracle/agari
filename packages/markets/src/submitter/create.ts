import type { AttributionHook, IntentJournal, StopGate, Submitter } from "@agari/core/ports";
import type { Address } from "@agari/core/types";
import type { TransactionSigner } from "@solana/kit";
import { nowMs as chainNowMs } from "../provider/clock";
import type { Enqueue } from "../sessions/nonce-queue";
import { notDeployed } from "../stub/not-deployed";
import { noopAttribution } from "./attribution";
import { indexEvidence, type WriteEvidence } from "./evidence";
import { checkGas, type FeeLane, type GasCheck } from "./fees";
import { createMemoryJournal } from "./journal-memory";
import type { WriteRpc } from "./steps/message";
import { allowAllStopGate } from "./stop-gate";
import { writeRpc } from "./write-rpc";

export interface SubmitterDeps {
  /** The single account this submitter signs for. */
  wallet: Address;
  /** The session's Kit signer for `wallet`: a Wallet Standard wallet or a keypair (first-call.md §3.4). */
  signer: TransactionSigner;
  /** Serialises sends so one account never races itself. */
  enqueue: Enqueue;
  /** Defaults to the read runtime's RPC. */
  rpc?: WriteRpc;
  /** The indexer API base (`/api/index`), for reconciling writes the chain alone can't answer. */
  indexerUrl?: string;
  /** Defaults to the index with the Ledger's history as fallback. */
  evidence?: WriteEvidence;
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
 * Binds the two write lanes to ONE account and ONE signer. There is no "is a signer connected?" question left at send
 * time: a submitter exists only because a session bound a signer, so `hasSigner` is constantly true.
 */
export function createSubmitter(deps: SubmitterDeps): MarketsSubmitter {
  const { wallet, enqueue } = deps;
  const nowMs = deps.nowMs ?? chainNowMs;
  const journal = deps.journal ?? createMemoryJournal(nowMs);
  const rpc = () => deps.rpc ?? writeRpc();
  return {
    journal,
    stopGate: deps.stopGate ?? allowAllStopGate,
    attribution: deps.attribution ?? noopAttribution,
    wallet,
    hasSigner: () => true,
    submitTx: () => enqueue(async () => ({ status: "refused", diagnosis: notDeployed() }) as const),
    submitOrder: () => enqueue(async () => ({ status: "refused", diagnosis: notDeployed() }) as const),
    checkGas: (lane) => checkGas(rpc(), wallet, lane),
  };
}

/** The evidence a submitter reconciles with, from its deps. */
export function evidenceOf(deps: Pick<SubmitterDeps, "evidence" | "indexerUrl">, rpc: WriteRpc): WriteEvidence {
  return deps.evidence ?? indexEvidence(deps.indexerUrl, rpc);
}
