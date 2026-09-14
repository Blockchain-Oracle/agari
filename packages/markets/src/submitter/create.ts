import type { AttributionHook, IntentJournal, StopGate, Submitter } from "@agari/core/ports";
import type { Address } from "@agari/core/types";
import type { TransactionSigner } from "@solana/kit";
import { nowMs as chainNowMs } from "../provider/clock";
import type { Enqueue } from "../sessions/nonce-queue";
import { noopAttribution } from "./attribution";
import { indexEvidence, type WriteEvidence } from "./evidence";
import { checkGas, type FeeLane, type GasCheck } from "./fees";
import { createMemoryJournal } from "./journal-memory";
import { chainReconcilerWith, type Reconciler } from "./recovery";
import type { WriteRpc } from "./steps/message";
import { submitOrder } from "./order-lane";
import type { WriteContext } from "./settle-write";
import { allowAllStopGate } from "./stop-gate";
import { submitTx } from "./tx-lane";
import { solana } from "../runtime/solana";

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
  /** Recovery's reconciler over this session's RPC and indexer: what `recoverUnresolved` asks about open intents. */
  readonly reconciler: Reconciler;
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
  const stopGate = deps.stopGate ?? allowAllStopGate;
  const attribution = deps.attribution ?? noopAttribution;
  // Resolved per write, so a read runtime rebuilt onto other endpoints is picked up by the next send.
  const context = (): WriteContext => {
    const rpc = deps.rpc ?? solana().rpc;
    return { wallet, signer: deps.signer, rpc, journal, evidence: evidenceOf(deps, rpc), nowMs };
  };
  return {
    journal,
    stopGate,
    attribution,
    wallet,
    reconciler: (owner, record) => chainReconcilerWith(context())(owner, record),
    hasSigner: () => true,
    submitTx: (intent, onPhase) => enqueue(() => submitTx(context(), intent, onPhase)),
    submitOrder: (request, onPhase) => enqueue(() => submitOrder({ ...context(), stopGate, attribution }, request, onPhase)),
    checkGas: (lane) => checkGas(deps.rpc ?? solana().rpc, wallet, lane),
  };
}

/** The evidence a submitter reconciles with, from its deps. */
export function evidenceOf(deps: Pick<SubmitterDeps, "evidence" | "indexerUrl">, rpc: WriteRpc): WriteEvidence {
  return deps.evidence ?? indexEvidence(deps.indexerUrl, rpc);
}
