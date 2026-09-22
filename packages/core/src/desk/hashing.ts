/**
 * Canonical hashing of decision records (desk.md §6). The fingerprint written on chain must be reproducible by
 * anyone, in any language, from the stored record: RFC 8785 (JSON Canonicalization Scheme) bytes, sha256.
 *
 * Hard rule: no floats and no bigints inside a hashed record. `0.1 + 0.2` serialises as `0.30000000000000004`, which a
 * second implementation may not reproduce. Every amount, price, weight and ratio is a decimal STRING or a safe integer
 * (basis points, seconds, counts). With floats banned, RFC 8785 reduces to what JavaScript already does exactly as the
 * RFC requires: object keys sorted by UTF-16 code units (the default sort) and `JSON.stringify` string escaping.
 *
 * The chain head is the program's: `head = sha256(head ‖ seq LE u64 ‖ decision_hash)` from a zero genesis
 * (`agari-desk` `chain.rs`); `anchor/tests/vectors/desk/chain-head.json` is asserted on both sides.
 */
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";
import type { Hash32 } from "../types/primitives";

export const ZERO_HASH: Hash32 = `0x${"0".repeat(64)}`;

export class UnhashableValueError extends Error {
  constructor(path: string, why: string) {
    super(`Record is not hashable at ${path || "<root>"}: ${why}`);
    this.name = "UnhashableValueError";
  }
}

function serialise(value: unknown, path: string): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isSafeInteger(value)) throw new UnhashableValueError(path, `number ${value} is not a safe integer. Use a decimal string.`);
      return String(value === 0 ? 0 : value); // -0 becomes 0, as the RFC requires
    case "bigint":
      throw new UnhashableValueError(path, "bigint. Call .toString() first.");
    case "undefined":
      throw new UnhashableValueError(path, "undefined. Use null so the field is visible in the record.");
    case "object": {
      if (Array.isArray(value)) return `[${value.map((v, i) => serialise(v, `${path}[${i}]`)).join(",")}]`;
      if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
        throw new UnhashableValueError(path, "not a plain object (Date, Map, class instance). Convert it first.");
      }
      const obj = value as Record<string, unknown>;
      const body = Object.keys(obj)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${serialise(obj[k], path ? `${path}.${k}` : k)}`);
      return `{${body.join(",")}}`;
    }
    default:
      throw new UnhashableValueError(path, `unsupported type ${typeof value}`);
  }
}

/** Throws if the value breaks the no-float rule. Names the offending path. */
export function assertHashable(value: unknown): void {
  serialise(value, "");
}

/** RFC 8785 canonical JSON for the restricted value domain. */
export function canonicalJson(value: unknown): string {
  return serialise(value, "");
}

export const toHash32 = (bytes: Uint8Array): Hash32 => `0x${bytesToHex(bytes)}`;

/** The 32 bytes of a `0x`-prefixed hash, for an instruction argument. */
export function hash32Bytes(hash: Hash32): Uint8Array {
  const bytes = hexToBytes(hash.slice(2));
  if (bytes.length !== 32) throw new Error(`expected a 32-byte hash, got ${bytes.length} bytes`);
  return bytes;
}

/** sha256 over the canonical JSON bytes (UTF-8). This is the `decision_hash` sent on chain. */
export function hashRecord(record: unknown): Hash32 {
  return toHash32(sha256(utf8ToBytes(canonicalJson(record))));
}

/** Recompute and compare. Used by "Check it" and by the runner after every transaction. */
export function verifyRecord(record: unknown, expected: Hash32): boolean {
  return hashRecord(record).toLowerCase() === expected.toLowerCase();
}

/** `sha256(prev ‖ seq LE u64 ‖ hash)`: the program's `head` after sealing record `seq`. */
export function chainHead(prevHead: Hash32, seq: bigint, decisionHash: Hash32): Hash32 {
  if (seq < 0n || seq > 0xffff_ffff_ffff_ffffn) throw new Error(`seq ${seq} is not a u64`);
  const bytes = new Uint8Array(72);
  bytes.set(hash32Bytes(prevHead), 0);
  new DataView(bytes.buffer).setBigUint64(32, seq, true);
  bytes.set(hash32Bytes(decisionHash), 40);
  return toHash32(sha256(bytes));
}

/** The head after sealing `hashes` in order from `genesis` (a reconcile replays the record this way). */
export function replayChain(genesis: Hash32, firstSeq: bigint, hashes: readonly Hash32[]): Hash32 {
  let head = genesis;
  hashes.forEach((hash, i) => {
    head = chainHead(head, firstSeq + BigInt(i), hash);
  });
  return head;
}
