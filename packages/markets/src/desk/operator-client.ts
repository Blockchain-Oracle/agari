/**
 * The desk operator's client (plan §8 C3), server-side only: one role key (`DESK_RUNNER_PRIVATE_KEY`) on one mainnet
 * RPC, one send at a time. Every send is build → compress with the route's lookup tables → simulate at the ceiling →
 * limit to the simulated units plus the margin → sign → send → confirm → decode the desk's events. A refusal in
 * simulation throws before anything is signed; a landed failure throws with the program's own words; a send whose
 * fate is unknown throws `DeskSendUnknownError`, and the runner holds new sends until it reconciles by signature.
 */
import { AGARI_DESK_PROGRAM_ADDRESS, getAgariDeskErrorMessage } from "@agari/clients/agari-desk";
import { COMPUTE_MARGIN_BPS, COMPUTE_UNIT_LIMIT_MAX } from "@agari/core/constants";
import type { Signature } from "@agari/core/types";
import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createSolanaRpcFromTransport,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getBase64Encoder,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageComputeUnitLimit,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
  type KeyPairSigner,
} from "@solana/kit";
import { keypairSigner } from "../deploy/client";
import { retryingRpcTransport } from "../deploy/rpc-transport";
import { chainFailure, customCode } from "../submitter/chain-failure";
import { describeChainFailure, SimulationFailedError, type ChainFailure } from "../submitter/errors";
import { failingProgramId } from "../submitter/product-failure";
import { confirmStep } from "../submitter/steps/confirm";
import type { WriteRpc } from "../submitter/steps/message";
import { sendStep } from "../submitter/steps/send";
import { readDeskEventsOf, type DeskEvent } from "./history";
import { fetchLookupTables, withLookupTables } from "./lookup-tables";

const BPS = 10_000;

export interface DeskOperatorClientConfig {
  /** The operator role's 64-byte keypair. Never logged. */
  secretKey: Uint8Array;
  /** A mainnet RPC URL; may carry a provider key, never logged. */
  rpcUrl: string;
  /** Core `CLUSTER_ID` of the cluster behind `rpcUrl` (101 on mainnet, 104 on a Surfpool fork). */
  clusterTag: number;
}

export interface DeskSendOptions {
  /** Address lookup tables the message is compressed with (a Jupiter route's). */
  lookupTables?: readonly Address[];
  abortSignal?: AbortSignal;
}

export interface DeskSendResult {
  signature: Signature;
  slot: bigint;
  computeUnitLimit: number;
  unitsConsumed: number;
  /** The wire size of the transaction as simulated (the 1,232-byte limit is the route's real bound). */
  bytes: number;
  events: DeskEvent[];
}

const DESK_CODES = { min: 7000, max: 7299 };

/**
 * The desk's own error code in a failure, or null. The desk numbers its errors 7000–7299 (desk.md §4.6), outside the
 * engine's 6000–6399, so `ChainFailure.engineCode` (the events program's table) never carries one: the code is read
 * from the raw `Custom(code)`, and only when the program the logs name as failing is the desk (or none is named).
 */
export function deskErrorCode(failure: ChainFailure): number | null {
  const code = customCode(failure.err);
  if (code === null || code < DESK_CODES.min || code > DESK_CODES.max) return null;
  const program = failingProgramId(failure.logs);
  return program === null || program === (AGARI_DESK_PROGRAM_ADDRESS as string) ? code : null;
}

/** The chain refused the transaction, in simulation or once landed. `deskCode` is the desk's own error, when it is one. */
export class DeskSendError extends Error {
  readonly deskCode: number | null;
  constructor(readonly stage: "simulation" | "landed", readonly failure: ChainFailure, readonly signature: Signature | null) {
    const code = deskErrorCode(failure);
    super(code !== null ? `agari-desk ${code}: ${getAgariDeskErrorMessage(code as never) ?? describeChainFailure(failure)}` : describeChainFailure(failure));
    this.name = "DeskSendError";
    this.deskCode = code;
  }
}

/** Signed bytes left the process and no confirmation came back: only the chain knows. */
export class DeskSendUnknownError extends Error {
  constructor(readonly signature: Signature, readonly reason: "expired" | "cap") {
    super(`send ${signature} unconfirmed (${reason}); reconcile by signature before sending again`);
    this.name = "DeskSendUnknownError";
  }
}

export interface DeskOperatorClient {
  readonly address: Address;
  readonly signer: KeyPairSigner;
  readonly rpc: WriteRpc;
  readonly clusterTag: number;
  readonly programId: Address;
  /** Simulates without signing: the units a send would take, or the refusal. */
  simulate(instructions: readonly Instruction[], options?: DeskSendOptions): Promise<{ unitsConsumed: number; bytes: number }>;
  /** Builds, signs, sends and confirms one transaction; sends are serialised through one queue. */
  send(step: string, instructions: readonly Instruction[], options?: DeskSendOptions): Promise<DeskSendResult>;
}

async function compose(client: DeskOperatorClient, instructions: readonly Instruction[], options: DeskSendOptions) {
  const [{ value: latest }, tables] = await Promise.all([
    client.rpc.getLatestBlockhash({ commitment: "confirmed" }).send(),
    fetchLookupTables(client.rpc, options.lookupTables ?? []),
  ]);
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(client.signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latest, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
    (m) => withLookupTables(m, tables),
  );
  return { message, lastValidBlockHeight: latest.lastValidBlockHeight };
}

async function simulateAt(client: DeskOperatorClient, message: Awaited<ReturnType<typeof compose>>["message"], limit: number) {
  const wire = getBase64EncodedWireTransaction(compileTransaction(setTransactionMessageComputeUnitLimit(limit, message)));
  const { value } = await client.rpc.simulateTransaction(wire, { encoding: "base64", sigVerify: false, commitment: "confirmed" }).send();
  if (value.err) throw new DeskSendError("simulation", chainFailure(value.err, value.logs), null);
  return { unitsConsumed: Number(value.unitsConsumed ?? BigInt(COMPUTE_UNIT_LIMIT_MAX)), bytes: getBase64Encoder().encode(wire).length };
}

export async function createDeskOperatorClient(config: DeskOperatorClientConfig): Promise<DeskOperatorClient> {
  const signer = await keypairSigner(config.secretKey);
  const rpc = createSolanaRpcFromTransport(retryingRpcTransport(config.rpcUrl, "normal")) as WriteRpc;
  let queue: Promise<unknown> = Promise.resolve();

  const client: DeskOperatorClient = {
    address: signer.address,
    signer,
    rpc,
    clusterTag: config.clusterTag,
    programId: AGARI_DESK_PROGRAM_ADDRESS,
    async simulate(instructions, options = {}) {
      const { message } = await compose(client, instructions, options);
      return simulateAt(client, message, COMPUTE_UNIT_LIMIT_MAX);
    },
    send(step, instructions, options = {}) {
      const run = async (): Promise<DeskSendResult> => {
        const { message, lastValidBlockHeight } = await compose(client, instructions, options);
        const sim = await simulateAt(client, message, COMPUTE_UNIT_LIMIT_MAX);
        const computeUnitLimit = Math.min(COMPUTE_UNIT_LIMIT_MAX, Math.ceil((sim.unitsConsumed * COMPUTE_MARGIN_BPS) / BPS));
        const transaction = await signTransactionMessageWithSigners(setTransactionMessageComputeUnitLimit(computeUnitLimit, message), options.abortSignal ? { abortSignal: options.abortSignal } : {});
        const signature = getSignatureFromTransaction(transaction) as string as Signature;
        const wire = getBase64EncodedWireTransaction(transaction);
        try {
          await sendStep(client.rpc, wire);
        } catch (error) {
          if (error instanceof SimulationFailedError) throw new DeskSendError("simulation", error.failure, null);
          throw error;
        }
        const landing = await confirmStep(client.rpc, { signature, wire, lastValidBlockHeight });
        if (landing.kind === "unknown") throw new DeskSendUnknownError(signature, landing.reason);
        if (landing.kind === "landed-failed") throw new DeskSendError("landed", landing.failure, signature);
        const events = await readDeskEventsOf(client.rpc, signature as string as Parameters<typeof readDeskEventsOf>[1]);
        return { signature, slot: landing.slot, computeUnitLimit, unitsConsumed: sim.unitsConsumed, bytes: sim.bytes, events };
      };
      // `step` names the action in a failure ("buy: agari-desk 7208: …"), so a log line says what was being sent.
      const named = () =>
        run().catch((error: unknown) => {
          if (error instanceof Error && !error.message.startsWith(`${step}: `)) error.message = `${step}: ${error.message}`;
          throw error;
        });
      const next = queue.then(named, named);
      queue = next.then(() => undefined, () => undefined);
      return next;
    },
  };
  return client;
}
