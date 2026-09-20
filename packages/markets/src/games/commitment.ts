import { deckCommitmentPreimage, type DeckCommitmentInput } from "@agari/core/games";
import type { Hash32, Hex } from "@agari/core/types";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

/**
 * keccak-256 over the bytes a `0x`-hex string encodes: the hash a deck commitment, a Lucky seed and a candidate set
 * are taken over. `@agari/core` carries no crypto by design, so it builds the preimage and the caller hashes it.
 *
 * It lives here, once, because three places need the same digest and a second implementation is a second chance to
 * get it wrong: the browser verifying a reveal, the ops deckmaster sealing one, and `agari-arena`'s own
 * `solana_keccak_hasher::hash`, whose packing is pinned to core's golden vector by the program's test.
 */
export function keccak256(data: Hex): Hash32 {
  return `0x${bytesToHex(keccak_256(hexToBytes(data.slice(2))))}`;
}

/** The commitment for one deck: what the creator publishes, and what the reveal must reproduce. */
export function deckCommitment(input: DeckCommitmentInput): Hash32 {
  return keccak256(deckCommitmentPreimage(input));
}
