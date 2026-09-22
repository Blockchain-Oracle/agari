/**
 * The attested reference (desk.md §3): the 114-byte `agari-desk-ref-v1` message the price attestor signs, and the
 * ed25519 precompile instruction that must sit immediately before `public_post_reference`. The attestor is an ops
 * key (`PRICE_ATTESTOR_PRIVATE_KEY`); the program checks it against `DeskConfig.attestors`.
 */
import { AGARI_DESK_PROGRAM_ADDRESS } from "@agari/clients/agari-desk";
import { getAddressEncoder, getI64Encoder, getU64Encoder, type Address, type Instruction, type KeyPairSigner, type TransactionSigner } from "@solana/kit";
import { ed25519Instruction } from "../prices/attested";
import { postReferenceIx } from "./instructions";

export const DESK_REF_MESSAGE_BYTES = 114;
const DOMAIN = new TextEncoder().encode("agari-desk-ref-v1");

export interface DeskReferenceFields {
  programId: Address;
  clusterTag: number;
  mint: Address;
  tokenPriceE8: bigint;
  markPriceE8: bigint;
  multiplierE12: bigint;
  fetchedAtSec: number;
}

/** `domain(17) ‖ program(32) ‖ cluster_tag(1) ‖ mint(32) ‖ token_price_e8 u64 ‖ mark_price_e8 u64 ‖ multiplier_e12 u64 ‖ fetched_at_sec i64`, little-endian. */
export function deskReferenceMessage(f: DeskReferenceFields): Uint8Array {
  const u64 = getU64Encoder();
  const parts: Uint8Array[] = [
    DOMAIN,
    new Uint8Array(getAddressEncoder().encode(f.programId)),
    Uint8Array.of(f.clusterTag),
    new Uint8Array(getAddressEncoder().encode(f.mint)),
    new Uint8Array(u64.encode(f.tokenPriceE8)),
    new Uint8Array(u64.encode(f.markPriceE8)),
    new Uint8Array(u64.encode(f.multiplierE12)),
    new Uint8Array(getI64Encoder().encode(BigInt(f.fetchedAtSec))),
  ];
  const out = new Uint8Array(DESK_REF_MESSAGE_BYTES);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  if (at !== DESK_REF_MESSAGE_BYTES) throw new Error(`desk reference message is ${at} bytes`);
  return out;
}

export interface PostReferenceInput {
  /** The attestor key pair: it signs the message; it need not pay. */
  attestor: KeyPairSigner;
  payer: TransactionSigner;
  mint: Address;
  clusterTag: number;
  tokenPriceE8: bigint;
  markPriceE8: bigint;
  multiplierE12: bigint;
  fetchedAtSec: number;
  programId?: Address;
}

/** `[ed25519 over the 114 B message, public_post_reference]`: the precompile first, every offset naming itself. */
export async function postReferenceInstructions(i: PostReferenceInput): Promise<[Instruction, Instruction]> {
  const message = deskReferenceMessage({ programId: i.programId ?? AGARI_DESK_PROGRAM_ADDRESS, clusterTag: i.clusterTag, mint: i.mint, tokenPriceE8: i.tokenPriceE8, markPriceE8: i.markPriceE8, multiplierE12: i.multiplierE12, fetchedAtSec: i.fetchedAtSec });
  return [
    await ed25519Instruction(i.attestor, message, 0xffff),
    await postReferenceIx({ payer: i.payer, mint: i.mint, tokenPriceE8: i.tokenPriceE8, markPriceE8: i.markPriceE8, multiplierE12: i.multiplierE12, fetchedAtSec: i.fetchedAtSec }),
  ];
}
