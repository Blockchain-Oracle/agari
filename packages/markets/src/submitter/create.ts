import type { GasLane } from "@masayume/core/constants";
import type { AttributionHook, IntentJournal, StopGate, Submitter } from "@masayume/core/ports";
import type { Address } from "@masayume/core/types";
import type { Enqueue } from "../sessions/nonce-queue";
import type { SessionTrader } from "../sessions/trader";
import { nowMs as chainNowMs } from "../provider/clock";
import { noopAttribution } from "./attribution";
import { checkGas, type GasCheck } from "./gas";
import { createMemoryJournal } from "./journal-memory";
import { submitOrder } from "./order-lane";
import { allowAllStopGate } from "./stop-gate";
import { submitTx } from "./tx-lane";
import type { VaultContracts } from "../vault/write";

export interface SubmitterDeps {
  /** The owning session's bound trader. It cannot be replaced for the life of the session. */
  trader: SessionTrader;
  /** The single account this submitter signs for. */
  wallet: Address;
  /** Serialises sends so one account never races itself on the nonce. */
  enqueue: Enqueue;
  stopGate?: StopGate;
  journal?: IntentJournal;
  attribution?: AttributionHook;
  nowMs?: () => number;
  /** The session's viem clients for Masayume's contracts; absent in a read-only context. */
  contracts?: VaultContracts;
}

/** The core Submitter plus the pre-send checks a surface needs before it opens a wallet popup. */
export interface MarketsSubmitter extends Submitter {
  readonly journal: IntentJournal;
  readonly stopGate: StopGate;
  readonly attribution: AttributionHook;
  readonly wallet: Address;
  checkGas(lane: GasLane): Promise<GasCheck>;
}

/**
 * Binds the two write lanes to ONE account.
 *
 * There is no "is a signer connected?" question left to ask at send time: a submitter only
 * exists because a session exists, and a session only exists for a signer that is already
 * bound. `hasSigner` stays on the port for callers that still branch on it, and is
 * constantly true here by construction.
 */
export function createSubmitter(deps: SubmitterDeps): MarketsSubmitter {
  const { trader, wallet, enqueue, contracts } = deps;
  const nowMs = deps.nowMs ?? chainNowMs;
  const journal = deps.journal ?? createMemoryJournal(nowMs);
  const stopGate = deps.stopGate ?? allowAllStopGate;
  const attribution = deps.attribution ?? noopAttribution;

  return {
    journal,
    stopGate,
    attribution,
    wallet,
    hasSigner: () => true,
    submitTx: (intent, onPhase) => enqueue(() => submitTx({ journal, trader, wallet, contracts }, intent, onPhase)),
    submitOrder: (request, onPhase) =>
      enqueue(() => submitOrder({ journal, stopGate, attribution, nowMs, trader, wallet, contracts }, request, onPhase)),
    checkGas: (lane) => checkGas(wallet, lane),
  };
}
