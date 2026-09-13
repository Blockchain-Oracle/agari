import type { Bytes32, Hex } from "@masayume/core/types";
import { concatHex, keccak256, parseSignature, serializeSignature, stringToHex, type Hex as ViemHex } from "viem";

/** secp256k1's group order halved: a signature with `s` above it is the malleated twin of a canonical one. */
const HALF_ORDER = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0n;

/**
 * One authorisation, one byte form. viem verifies a high-`s` signature and either `v` encoding, so without this
 * one signed message would map to four slots and four charges. Returns null for a signature that is not the
 * canonical low-`s` form — those are refused, never normalised, so the bytes the wallet showed are the bytes used.
 */
export function canonicalSignature(signature: Hex): Hex | null {
  try {
    const parsed = parseSignature(signature as ViemHex);
    if (BigInt(parsed.s) > HALF_ORDER) return null;
    const yParity = parsed.yParity ?? (parsed.v === undefined ? undefined : parsed.v === 27n || parsed.v === 0n ? 0 : parsed.v === 28n || parsed.v === 1n ? 1 : undefined);
    if (yParity !== 0 && yParity !== 1) return null;
    return serializeSignature({ r: parsed.r, s: parsed.s, yParity }) as Hex;
  } catch {
    return null;
  }
}

/** The three keys one private bet uses on chain, derived from one secret the owner and the desk alone hold. */
export interface SlotKeys {
  /** The slot's id — on every SLOT-side call, never beside the owner. */
  slotId: Bytes32;
  /** On the charge, beside the owner — never beside the slot. */
  chargeKey: Bytes32;
  /** On the credit, beside the owner — carried in the claim so the desk can find it without the secret. */
  creditKey: Bytes32;
}

/**
 * The secret is the owner's own authorisation signature: it never touches the chain, so the three hashes
 * cannot be joined without it — and a desk that lost its way mid-open re-derives them from the same
 * signature and reads what already landed off the contract. No record, no owner on any slot.
 */
export function deriveSlotKeys(authSignature: Hex): SlotKeys {
  const seed = keccak256(authSignature);
  const derive = (label: string) => keccak256(concatHex([seed, stringToHex(label)])) as Bytes32;
  return { slotId: derive("slot"), chargeKey: derive("charge"), creditKey: derive("credit") };
}
