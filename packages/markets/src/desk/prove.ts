/**
 * Prove-limits sends (plan §8 C6 F): a transaction the program is EXPECTED to refuse, simulated to name the refusal
 * and then, when asked, sent WITHOUT preflight so the refusal lands on the fork as a failed transaction with a
 * signature, exactly as a stolen operator key's attempt would land on mainnet. Drive evidence only: the runner never
 * sends anything it has not simulated clean, and nothing here is reachable from it.
 */
import { COMPUTE_UNIT_LIMIT_MAX } from "@agari/core/constants";
import type { Signature } from "@agari/core/types";
import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageComputeUnitLimit,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
  type KeyPairSigner,
  type Signature as KitSignature,
} from "@solana/kit";
import { AGARI_DESK_PROGRAM_ADDRESS, getOwnerWithdrawInstructionAsync } from "@agari/clients/agari-desk";
import { chainFailure, customCode } from "../submitter/chain-failure";
import { describeChainFailure, type ChainFailure } from "../submitter/errors";
import { associatedTokenAddress, deskAddress, deskEventAuthority, tokenProgramOf } from "./deployment";
import { fetchLookupTables, withLookupTables } from "./lookup-tables";
import { deskErrorCode, type DeskOperatorClient } from "./operator-client";

/**
 * `owner_withdraw` signed by someone who is not the owner, aimed at the real desk (the owner's PDA) and paying the
 * signer's own associated account: what a stolen operator key would try. Built only to be refused.
 */
export async function withdrawAsStrangerIx(signer: KeyPairSigner, deskOwner: Address, mint: Address, amount: bigint): Promise<Instruction> {
  const tokenProgram = tokenProgramOf(mint);
  const [desk, ownerAta, eventAuthority] = await Promise.all([deskAddress(deskOwner), associatedTokenAddress(signer.address, mint, tokenProgram), deskEventAuthority()]);
  return getOwnerWithdrawInstructionAsync({ owner: signer, desk, mint, ownerAta, amount, tokenProgram, eventAuthority, program: AGARI_DESK_PROGRAM_ADDRESS });
}

export interface RefusalStage {
  /** The desk's own error (7000–7299) when the desk refused; null when another program or the runtime did. */
  deskCode: number | null;
  /** The raw `Custom(code)` of the failing instruction, whoever owns it. */
  customCode: number | null;
  error: string;
  logs: string[];
}

export interface Refusal {
  simulation: RefusalStage;
  /** The landed failure when the bytes were sent; null when `send` was false or the fork never recorded them. */
  landed: (RefusalStage & { signature: Signature; slot: bigint }) | null;
}

export interface RefusalOptions {
  lookupTables?: readonly Address[];
  /** Also send the signed bytes without preflight so a failed transaction exists on the fork (default true). */
  send?: boolean;
  /** Who pays and signs first; the operator when absent. */
  feePayer?: KeyPairSigner;
  /** How long to wait for the landed status. */
  confirmMs?: number;
}

const stage = (failure: ChainFailure): RefusalStage => ({ deskCode: deskErrorCode(failure), customCode: customCode(failure.err), error: describeChainFailure(failure), logs: [...failure.logs] });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Thrown when the transaction the drive expected to be refused would have passed: the limit did not bite. */
export class NotRefusedError extends Error {
  constructor(readonly unitsConsumed: number) {
    super(`expected a refusal, but the simulation passed (${unitsConsumed} CU)`);
    this.name = "NotRefusedError";
  }
}

/**
 * Simulates `instructions` and returns why the chain refuses them; with `send` (the default) the signed bytes are
 * also broadcast with `skipPreflight` and the landed failure is read back by signature. Throws `NotRefusedError`
 * when the simulation passes, so a check that expected a refusal fails loudly rather than moving money.
 */
export async function sendForRefusal(client: DeskOperatorClient, instructions: readonly Instruction[], options: RefusalOptions = {}): Promise<Refusal> {
  const payer = options.feePayer ?? client.signer;
  const [{ value: latest }, tables] = await Promise.all([client.rpc.getLatestBlockhash({ commitment: "confirmed" }).send(), fetchLookupTables(client.rpc, options.lookupTables ?? [])]);
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latest, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
    (m) => withLookupTables(m, tables),
    (m) => setTransactionMessageComputeUnitLimit(COMPUTE_UNIT_LIMIT_MAX, m),
  );
  const unsigned = getBase64EncodedWireTransaction(compileTransaction(message));
  const { value: sim } = await client.rpc.simulateTransaction(unsigned, { encoding: "base64", sigVerify: false, commitment: "confirmed" }).send();
  if (!sim.err) throw new NotRefusedError(Number(sim.unitsConsumed ?? 0n));
  const simulation = stage(chainFailure(sim.err, sim.logs));
  if (options.send === false) return { simulation, landed: null };

  const transaction = await signTransactionMessageWithSigners(message);
  const signature = getSignatureFromTransaction(transaction) as string as Signature;
  const wire = getBase64EncodedWireTransaction(transaction);
  try {
    await client.rpc.sendTransaction(wire, { encoding: "base64", skipPreflight: true, maxRetries: 0n }).send();
  } catch {
    // A node may still refuse the bytes outright (a sanitisation failure); the status poll below decides.
  }
  const until = Date.now() + (options.confirmMs ?? 30_000);
  while (Date.now() < until) {
    await sleep(1_000);
    const { value } = await client.rpc.getSignatureStatuses([signature as string as KitSignature], { searchTransactionHistory: true }).send();
    const status = value[0];
    if (!status || (status.confirmationStatus !== "confirmed" && status.confirmationStatus !== "finalized")) continue;
    if (!status.err) throw new Error(`${signature} landed successfully although the simulation refused it`);
    const tx = await client.rpc.getTransaction(signature as string as KitSignature, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" }).send();
    const failure = chainFailure(tx?.meta?.err ?? status.err, tx?.meta?.logMessages ?? null);
    return { simulation, landed: { ...stage(failure), signature, slot: status.slot } };
  }
  return { simulation, landed: null };
}
