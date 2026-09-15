import { encodeBase58 } from "@agari/core/types";

/**
 * The Solana wire transaction, decoded just far enough for the sponsor's policy (tap-trading.md §3 check 1): signatures,
 * the exact message bytes they sign, the header, every static key, the blockhash and the compiled instructions. Pure
 * and dependency-free, so web never imports Kit; lane 7b may swap it for Kit's `getTransactionDecoder` in markets.
 */
export interface CompiledInstruction {
  programIndex: number;
  accountIndexes: number[];
  data: Uint8Array;
}

export interface DecodedTransaction {
  signatures: Uint8Array[];
  /** Byte offset of the first signature inside the wire bytes (after the compact-u16 count). */
  signaturesOffset: number;
  messageBytes: Uint8Array;
  version: "legacy" | number;
  numRequiredSignatures: number;
  numReadonlySigned: number;
  numReadonlyUnsigned: number;
  staticKeys: string[];
  staticKeyBytes: Uint8Array[];
  recentBlockhash: string;
  instructions: CompiledInstruction[];
  addressTableLookups: number;
}

export const SIGNATURE_BYTES = 64;
const KEY_BYTES = 32;
/** The largest packet a transaction may be (IPv6 MTU minus headers). */
export const PACKET_DATA_SIZE = 1232;

class Reader {
  offset = 0;
  constructor(readonly bytes: Uint8Array) {}
  u8(): number {
    if (this.offset >= this.bytes.length) throw new Error("truncated");
    return this.bytes[this.offset++]!;
  }
  take(length: number): Uint8Array {
    if (this.offset + length > this.bytes.length) throw new Error("truncated");
    const out = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return out;
  }
  /** Solana's compact-u16 ("shortvec"): 7 bits a byte, at most 3 bytes, no redundant zero continuation. */
  shortvec(): number {
    let value = 0;
    for (let i = 0; i < 3; i += 1) {
      const byte = this.u8();
      value |= (byte & 0x7f) << (7 * i);
      if ((byte & 0x80) === 0) {
        if (i > 0 && byte === 0) throw new Error("non-canonical length");
        if (value > 0xffff) throw new Error("length overflow");
        return value;
      }
    }
    throw new Error("length overflow");
  }
}

const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** Strict base64 → bytes; null for anything that isn't canonical base64 of at most one packet. */
export function base64Bytes(text: unknown): Uint8Array | null {
  if (typeof text !== "string" || text.length === 0 || text.length > Math.ceil(PACKET_DATA_SIZE / 3) * 4 || !BASE64.test(text)) return null;
  return new Uint8Array(Buffer.from(text, "base64"));
}

export const toBase64 = (bytes: Uint8Array): string => Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");

/** Throws on anything malformed: truncation, trailing bytes, an index past the key list. */
export function decodeTransaction(wire: Uint8Array): DecodedTransaction {
  const r = new Reader(wire);
  const count = r.shortvec();
  const signaturesOffset = r.offset;
  const signatures = Array.from({ length: count }, () => r.take(SIGNATURE_BYTES));
  const messageStart = r.offset;
  const first = r.u8();
  let version: DecodedTransaction["version"] = "legacy";
  let numRequiredSignatures = first;
  if (first & 0x80) {
    version = first & 0x7f;
    numRequiredSignatures = r.u8();
  }
  const numReadonlySigned = r.u8();
  const numReadonlyUnsigned = r.u8();
  const staticKeyBytes = Array.from({ length: r.shortvec() }, () => r.take(KEY_BYTES));
  const recentBlockhash = encodeBase58(r.take(KEY_BYTES));
  const instructions = Array.from({ length: r.shortvec() }, (): CompiledInstruction => {
    const programIndex = r.u8();
    const accountIndexes = Array.from(r.take(r.shortvec()));
    const data = r.take(r.shortvec());
    return { programIndex, accountIndexes, data };
  });
  let addressTableLookups = 0;
  if (version !== "legacy") {
    addressTableLookups = r.shortvec();
    for (let i = 0; i < addressTableLookups; i += 1) {
      r.take(KEY_BYTES);
      r.take(r.shortvec());
      r.take(r.shortvec());
    }
  }
  if (r.offset !== wire.length) throw new Error("trailing bytes");
  if (count !== numRequiredSignatures) throw new Error("signature count does not match the header");
  if (numReadonlySigned >= numRequiredSignatures || numRequiredSignatures + numReadonlyUnsigned > staticKeyBytes.length) throw new Error("header does not fit the key list");
  const keys = staticKeyBytes.length;
  // Without lookups every index must land in the static list (a message with lookups is refused by the policy itself).
  const outside = instructions.some((ix) => ix.programIndex >= keys || ix.accountIndexes.some((index) => index >= keys));
  if (addressTableLookups === 0 && outside) throw new Error("instruction index outside the key list");
  const staticKeys = staticKeyBytes.map((key) => encodeBase58(key));
  if (new Set(staticKeys).size !== keys) throw new Error("duplicate account key");
  return {
    signatures,
    signaturesOffset,
    messageBytes: wire.subarray(messageStart),
    version,
    numRequiredSignatures,
    numReadonlySigned,
    numReadonlyUnsigned,
    staticKeys,
    staticKeyBytes,
    recentBlockhash,
    instructions,
    addressTableLookups,
  };
}

/** The wire bytes with signature slot `slot` filled; the input is never mutated. */
export function withSignature(wire: Uint8Array, decoded: DecodedTransaction, slot: number, signature: Uint8Array): Uint8Array {
  if (signature.length !== SIGNATURE_BYTES) throw new Error("an Ed25519 signature is 64 bytes");
  const out = new Uint8Array(wire);
  out.set(signature, decoded.signaturesOffset + slot * SIGNATURE_BYTES);
  return out;
}
