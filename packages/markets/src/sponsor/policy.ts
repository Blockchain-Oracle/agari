/**
 * The sponsor's static policy, checks 1–5 of tap-trading.md §3 (D-065), in order; the first failure is the answer.
 * Everything here reads only the bytes the client sent, through Kit's own transaction and message decoders: no chain,
 * no clock, no counters. Server-only (`@agari/markets/sponsor`).
 */
import { AgariVaultInstruction, identifyAgariVaultInstruction } from "@agari/clients/agari-vault";
import { COMPUTE_UNIT_LIMIT_MAX } from "@agari/core/constants";
import {
  COMPUTE_BUDGET_PROGRAM_ADDRESS,
  ComputeBudgetInstruction,
  getSetComputeUnitLimitInstructionDataDecoder,
  getSetComputeUnitPriceInstructionDataDecoder,
  identifyComputeBudgetInstruction,
} from "@solana-program/compute-budget";
import { getCompiledTransactionMessageDecoder, getPublicKeyFromAddress, getTransactionDecoder, verifySignature, type Address, type ReadonlyUint8Array, type Transaction } from "@solana/kit";
import { SPONSORABLE_INSTRUCTIONS, type SponsorableInstruction } from "./status";

/** Masayume's `SPONSORABLE_FUNCTIONS` (`M:packages/markets/src/vault/sponsor.ts:25-27`) on agari-vault, minus `sweep`. */
const SPONSORABLE = new Map<AgariVaultInstruction, SponsorableInstruction>([
  [AgariVaultInstruction.ActorPlaceFor, "actor_place_for"],
  [AgariVaultInstruction.PublicCrankSettle, "public_crank_settle"],
  [AgariVaultInstruction.OwnerWithdraw, "owner_withdraw"],
  [AgariVaultInstruction.OwnerWithdrawPrivate, "owner_withdraw_private"],
  [AgariVaultInstruction.OwnerRevoke, "owner_revoke"],
]);
if (SPONSORABLE.size !== SPONSORABLE_INSTRUCTIONS.length) throw new Error("sponsor allowlist drifted from its wire names");

const MAX_INSTRUCTIONS = 3;
const SIGNERS = 2;
const limitData = getSetComputeUnitLimitInstructionDataDecoder();
const priceData = getSetComputeUnitPriceInstructionDataDecoder();

export interface StaticLimits {
  maxComputeUnits: number;
  maxMicroLamports: bigint;
}

export type Refusal = { ok: false; status: 400 | 403 | 409 | 429 | 502 | 503; error: string };

export interface StaticPass {
  ok: true;
  transaction: Transaction;
  /** The fee payer's recent blockhash, as the message carries it. */
  blockhash: string;
  /** The one other signer (key, owner or cranker): the signer the gates count. */
  signer: Address;
  instruction: SponsorableInstruction;
  /** The transaction's own SetComputeUnitLimit, if it carries one. */
  computeUnitLimit: number | null;
}

export const refuse = (status: Refusal["status"], error: string): Refusal => ({ ok: false, status, error });

function decodeExactly(wire: ReadonlyUint8Array) {
  const [transaction, end] = getTransactionDecoder().read(wire, 0);
  if (end !== wire.length) throw new Error("trailing bytes");
  const [message, messageEnd] = getCompiledTransactionMessageDecoder().read(transaction.messageBytes, 0);
  if (messageEnd !== transaction.messageBytes.length) throw new Error("trailing message bytes");
  return { transaction, message };
}

export async function checkStatic(wire: ReadonlyUint8Array, sponsor: Address, vaultProgram: Address, limits: StaticLimits): Promise<StaticPass | Refusal> {
  // 1. A v0 message with every key visible.
  let decoded: ReturnType<typeof decodeExactly>;
  try {
    decoded = decodeExactly(wire);
  } catch (error) {
    return refuse(400, `not a Solana transaction (${error instanceof Error ? error.message : "undecodable"})`);
  }
  const { transaction, message } = decoded;
  if (message.version !== 0) return refuse(400, "the sponsor co-signs only v0 transactions");
  if ((message.addressTableLookups?.length ?? 0) > 0) return refuse(400, "address-table lookups hide accounts from the policy; the sponsor refuses them");
  const keys = message.staticAccounts;
  if (new Set(keys).size !== keys.length) return refuse(400, "duplicate account key");
  if (message.instructions.some((ix) => ix.programAddressIndex >= keys.length || (ix.accountIndices ?? []).some((i) => i >= keys.length))) {
    return refuse(400, "instruction index outside the key list");
  }

  // 2. The sponsor is the fee payer, and its slot is still empty.
  if (keys[0] !== sponsor) return refuse(403, "the fee payer is not this sponsor");
  const sponsorSignature = transaction.signatures[sponsor];
  if (sponsorSignature && sponsorSignature.some((b) => b !== 0)) return refuse(403, "the sponsor's signature slot is already filled");

  // 3. Exactly one other signer, whose signature is there and verifies over these message bytes.
  if (message.header.numSignerAccounts > SIGNERS) return refuse(403, `the sponsor co-signs at most ${SIGNERS} signatures`);
  if (message.header.numSignerAccounts < SIGNERS) return refuse(403, "the sponsor co-signs only beside the signer it pays for");
  const signer = keys[1]!;
  const signature = transaction.signatures[signer];
  if (!signature || signature.every((b) => b === 0)) return refuse(403, "the signer has not signed this transaction");
  const verified = await getPublicKeyFromAddress(signer)
    .then((key) => verifySignature(key, signature, transaction.messageBytes))
    .catch(() => false);
  if (!verified) return refuse(403, "the signer's signature does not verify over this message");

  // 4. At most three instructions: compute budget within the caps, and exactly one allowlisted agari-vault instruction.
  if (message.instructions.length > MAX_INSTRUCTIONS) return refuse(403, `the sponsor pays for at most ${MAX_INSTRUCTIONS} instructions`);
  const maxUnits = Math.min(limits.maxComputeUnits, COMPUTE_UNIT_LIMIT_MAX);
  let computeUnitLimit: number | null = null;
  let priceSeen = false;
  let instruction: SponsorableInstruction | null = null;
  for (const ix of message.instructions) {
    const program = keys[ix.programAddressIndex]!;
    const data = ix.data ?? new Uint8Array();
    if (program === COMPUTE_BUDGET_PROGRAM_ADDRESS) {
      if ((ix.accountIndices ?? []).length > 0) return refuse(403, "a compute-budget instruction takes no accounts");
      const kind = safely(() => identifyComputeBudgetInstruction(data));
      if (kind === ComputeBudgetInstruction.SetComputeUnitLimit && data.length === limitData.fixedSize) {
        if (computeUnitLimit !== null) return refuse(403, "more than one compute-unit limit");
        computeUnitLimit = limitData.decode(data).units;
        if (computeUnitLimit > maxUnits) return refuse(403, `compute-unit limit ${computeUnitLimit} is above the sponsor's ${maxUnits}`);
      } else if (kind === ComputeBudgetInstruction.SetComputeUnitPrice && data.length === priceData.fixedSize) {
        if (priceSeen) return refuse(403, "more than one compute-unit price");
        priceSeen = true;
        const price = priceData.decode(data).microLamports;
        if (price > limits.maxMicroLamports) return refuse(403, `compute-unit price ${price} is above the sponsor's ${limits.maxMicroLamports} micro-lamports`);
      } else {
        return refuse(403, "that compute-budget instruction is not sponsorable");
      }
      continue;
    }
    if (program !== vaultProgram) return refuse(403, `the sponsor pays only for agari-vault instructions, not ${program}`);
    const kind = safely(() => identifyAgariVaultInstruction(data));
    const name = kind === null ? undefined : SPONSORABLE.get(kind);
    if (!name) return refuse(403, "that agari-vault instruction is not on the sponsor's allowlist; deposits and grants are never sponsored");
    if (instruction !== null) return refuse(403, "the sponsor pays for exactly one agari-vault instruction");
    instruction = name;
  }
  if (instruction === null) return refuse(403, "no agari-vault instruction to sponsor");

  // 5. The sponsor lends no privilege: it appears in no instruction's accounts (never writable, signer, payer or source).
  if (message.instructions.some((ix) => (ix.accountIndices ?? []).includes(0))) return refuse(403, "the sponsor's key appears in an instruction's accounts");

  return { ok: true, transaction, blockhash: message.lifetimeToken, signer, instruction, computeUnitLimit };
}

function safely<T>(read: () => T): T | null {
  try {
    return read();
  } catch {
    return null;
  }
}
