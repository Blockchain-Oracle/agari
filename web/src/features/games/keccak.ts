import type { Hash32, Hex } from "@agari/core/types";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

/**
 * keccak256 over the bytes a 0x-hex string encodes — the commitment hash the deck, the Lucky seed and the candidate set
 * are taken over (`@agari/core/games` carries no crypto; the caller supplies it). The same `@noble/hashes` the ops
 * deckmaster uses, so both sides of a commitment hash with one implementation.
 */
export function keccak256(data: Hex): Hash32 {
  return `0x${bytesToHex(keccak_256(hexToBytes(data.slice(2))))}`;
}
