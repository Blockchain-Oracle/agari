import { createHash } from "node:crypto";
import { COMPUTE_UNIT_LIMIT_MAX } from "@agari/core/constants";
import { decodeTransaction, SIGNATURE_BYTES, type DecodedTransaction } from "./wire";

/**
 * The sponsor's static policy, checks 1–5 of tap-trading.md §3 (D-065), in order; the first failure is the answer.
 * Everything here reads only the bytes the client sent: no chain, no clock, no counters.
 */

/** Masayume's `SPONSORABLE_FUNCTIONS` (`M:packages/markets/src/vault/sponsor.ts:25-27`) on agari-vault, minus `sweep`. */
export const SPONSORABLE_INSTRUCTIONS = ["actor_place_for", "public_crank_settle", "owner_withdraw", "owner_withdraw_private", "owner_revoke"] as const;
export type SponsorableInstruction = (typeof SPONSORABLE_INSTRUCTIONS)[number];
export const SPONSOR_ALLOWLIST: readonly string[] = SPONSORABLE_INSTRUCTIONS.map((name) => `agari_vault:${name}`);

export const COMPUTE_BUDGET_PROGRAM = "ComputeBudget111111111111111111111111111111";
const SET_COMPUTE_UNIT_LIMIT = 2;
const SET_COMPUTE_UNIT_PRICE = 3;
const MAX_INSTRUCTIONS = 3;
const MAX_SIGNATURES = 2;

/** Anchor's instruction discriminator: the first 8 bytes of sha256("global:<name>"). */
export function anchorDiscriminator(name: string): Uint8Array {
  return new Uint8Array(createHash("sha256").update(`global:${name}`).digest().subarray(0, 8));
}

const DISCRIMINATORS = new Map<string, SponsorableInstruction>(SPONSORABLE_INSTRUCTIONS.map((name) => [Buffer.from(anchorDiscriminator(name)).toString("hex"), name]));

export interface StaticLimits {
  maxComputeUnits: number;
  maxMicroLamports: bigint;
}

export type Refusal = { ok: false; status: 400 | 403 | 409 | 429 | 502 | 503; error: string };

export interface StaticPass {
  ok: true;
  decoded: DecodedTransaction;
  /** The one other signer (key, owner or cranker): the signer the gates count. */
  signer: string;
  instruction: SponsorableInstruction;
  /** The transaction's own SetComputeUnitLimit, if it carries one. */
  computeUnitLimit: number | null;
}

const refuse = (status: Refusal["status"], error: string): Refusal => ({ ok: false, status, error });
const isZero = (bytes: Uint8Array) => bytes.every((b) => b === 0);
const u32le = (data: Uint8Array) => new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(1, true);
const u64le = (data: Uint8Array) => new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(1, true);

async function verifies(publicKey: Uint8Array, signature: Uint8Array, message: Uint8Array): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("raw", new Uint8Array(publicKey), "Ed25519", false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, new Uint8Array(signature), new Uint8Array(message));
  } catch {
    return false;
  }
}

export async function checkStatic(wire: Uint8Array, sponsor: string, vaultProgram: string, limits: StaticLimits): Promise<StaticPass | Refusal> {
  // 1. A v0 message with every key visible.
  let decoded: DecodedTransaction;
  try {
    decoded = decodeTransaction(wire);
  } catch (error) {
    return refuse(400, `not a Solana transaction (${error instanceof Error ? error.message : "undecodable"})`);
  }
  if (decoded.version !== 0) return refuse(400, "the sponsor co-signs only v0 transactions");
  if (decoded.addressTableLookups > 0) return refuse(400, "address-table lookups hide accounts from the policy; the sponsor refuses them");

  // 2. The sponsor is the fee payer, and its slot is still empty.
  if (decoded.staticKeys[0] !== sponsor) return refuse(403, "the fee payer is not this sponsor");
  if (!isZero(decoded.signatures[0]!)) return refuse(403, "the sponsor's signature slot is already filled");

  // 3. Exactly one other signer, whose signature is there and verifies over these message bytes.
  if (decoded.numRequiredSignatures > MAX_SIGNATURES) return refuse(403, `the sponsor co-signs at most ${MAX_SIGNATURES} signatures`);
  if (decoded.numRequiredSignatures < MAX_SIGNATURES) return refuse(403, "the sponsor co-signs only beside the signer it pays for");
  const signature = decoded.signatures[1]!;
  if (signature.length !== SIGNATURE_BYTES || isZero(signature)) return refuse(403, "the signer has not signed this transaction");
  if (!(await verifies(decoded.staticKeyBytes[1]!, signature, decoded.messageBytes))) return refuse(403, "the signer's signature does not verify over this message");

  // 4. At most three instructions: compute budget within the caps, and exactly one allowlisted agari-vault instruction.
  if (decoded.instructions.length > MAX_INSTRUCTIONS) return refuse(403, `the sponsor pays for at most ${MAX_INSTRUCTIONS} instructions`);
  const maxUnits = Math.min(limits.maxComputeUnits, COMPUTE_UNIT_LIMIT_MAX);
  let computeUnitLimit: number | null = null;
  let priceSeen = false;
  let instruction: SponsorableInstruction | null = null;
  for (const ix of decoded.instructions) {
    const program = decoded.staticKeys[ix.programIndex]!;
    if (program === COMPUTE_BUDGET_PROGRAM) {
      const kind = ix.data[0];
      if (ix.accountIndexes.length > 0) return refuse(403, "a compute-budget instruction takes no accounts");
      if (kind === SET_COMPUTE_UNIT_LIMIT && ix.data.length === 5) {
        if (computeUnitLimit !== null) return refuse(403, "more than one compute-unit limit");
        computeUnitLimit = u32le(ix.data);
        if (computeUnitLimit > maxUnits) return refuse(403, `compute-unit limit ${computeUnitLimit} is above the sponsor's ${maxUnits}`);
      } else if (kind === SET_COMPUTE_UNIT_PRICE && ix.data.length === 9) {
        if (priceSeen) return refuse(403, "more than one compute-unit price");
        priceSeen = true;
        const price = u64le(ix.data);
        if (price > limits.maxMicroLamports) return refuse(403, `compute-unit price ${price} is above the sponsor's ${limits.maxMicroLamports} micro-lamports`);
      } else {
        return refuse(403, "that compute-budget instruction is not sponsorable");
      }
      continue;
    }
    if (program !== vaultProgram) return refuse(403, `the sponsor pays only for agari-vault instructions, not ${program}`);
    const name = ix.data.length >= 8 ? DISCRIMINATORS.get(Buffer.from(ix.data.subarray(0, 8)).toString("hex")) : undefined;
    if (!name) return refuse(403, "that agari-vault instruction is not on the sponsor's allowlist; deposits and grants are never sponsored");
    if (instruction !== null) return refuse(403, "the sponsor pays for exactly one agari-vault instruction");
    instruction = name;
  }
  if (instruction === null) return refuse(403, "no agari-vault instruction to sponsor");

  // 5. The sponsor lends no privilege: it appears in no instruction's accounts (never writable, signer, payer or source).
  if (decoded.instructions.some((ix) => ix.accountIndexes.includes(0))) return refuse(403, "the sponsor's key appears in an instruction's accounts");

  return { ok: true, decoded, signer: decoded.staticKeys[1]!, instruction, computeUnitLimit };
}
