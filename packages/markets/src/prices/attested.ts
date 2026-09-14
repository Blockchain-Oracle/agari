/**
 * Attested prints (prints.md §4.3): the 158-byte domain-separated message an attestor signs, and the ed25519
 * precompile instruction that must sit immediately before `public_record_print_attested`. Opt-in demo data only.
 */
import {
  address,
  getAddressEncoder,
  getI32Encoder,
  getI64Encoder,
  getU16Encoder,
  signBytes,
  type Address,
  type Instruction,
  type KeyPairSigner,
} from "@solana/kit";

export const ED25519_PROGRAM_ADDRESS = address("Ed25519SigVerify111111111111111111111111111");
export const ATTESTED_MESSAGE_BYTES = 158;
const DOMAIN = new TextEncoder().encode("agari-print-v1");

export type AttestedFields = {
  programId: Address;
  clusterTag: number;
  market: Address;
  /** 0 open, 1 close, 2 check open, 3 check close. */
  which: number;
  boundaryTs: bigint;
  price: bigint;
  expo: number;
  /** `policy.feed_id`: the attested source hash. */
  feedId: Uint8Array;
  barLenSec: number;
  fetchedAtTs: bigint;
};

/** Integers little-endian; `source_ts = T` and `bar_start_ts = T − bar_len_sec` are derived, not passed. */
export function attestedMessage(f: AttestedFields): Uint8Array {
  if (f.feedId.length !== 32) throw new Error("feedId must be 32 bytes");
  const i64 = getI64Encoder();
  const parts: Uint8Array[] = [
    DOMAIN,
    new Uint8Array(getAddressEncoder().encode(f.programId)),
    Uint8Array.of(f.clusterTag),
    new Uint8Array(getAddressEncoder().encode(f.market)),
    Uint8Array.of(f.which),
    new Uint8Array(i64.encode(f.boundaryTs)),
    new Uint8Array(i64.encode(f.price)),
    new Uint8Array(getI32Encoder().encode(f.expo)),
    new Uint8Array(i64.encode(f.boundaryTs)),
    f.feedId,
    new Uint8Array(i64.encode(f.boundaryTs - BigInt(f.barLenSec))),
    new Uint8Array(getU16Encoder().encode(f.barLenSec)),
    new Uint8Array(i64.encode(f.fetchedAtTs)),
  ];
  const out = new Uint8Array(ATTESTED_MESSAGE_BYTES);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  if (at !== ATTESTED_MESSAGE_BYTES) throw new Error(`attested message is ${at} bytes`);
  return out;
}

/**
 * `[1, 0, sig_off, idx, key_off, idx, msg_off, len, idx] ‖ pubkey ‖ signature ‖ message`, every offset naming `index`:
 * the instruction's own position, or `u16::MAX` for "this instruction". No offset can point into another instruction.
 */
export async function ed25519Instruction(signer: KeyPairSigner, message: Uint8Array, index = 0xffff): Promise<Instruction> {
  const signature = await signBytes(signer.keyPair.privateKey, message);
  const [keyOff, sigOff, msgOff] = [16, 48, 112];
  const data = new Uint8Array(msgOff + message.length);
  const view = new DataView(data.buffer);
  data[0] = 1;
  [sigOff, index, keyOff, index, msgOff, message.length, index].forEach((v, i) => view.setUint16(2 + i * 2, v, true));
  data.set(getAddressEncoder().encode(signer.address), keyOff);
  data.set(signature, sigOff);
  data.set(message, msgOff);
  return { programAddress: ED25519_PROGRAM_ADDRESS, accounts: [], data };
}
