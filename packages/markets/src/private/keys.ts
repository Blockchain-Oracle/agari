import { decodeBase58, type Hash32, type Signature } from "@agari/core/types";
import { keyHex } from "./deployment";

/** The three keys one private bet uses on chain, derived from one secret the owner and the desk alone hold. */
export interface SlotKeys {
  /** The slot's id: on every SLOT-side instruction, never beside the owner. */
  slotId: Hash32;
  /** On the charge, beside the owner, never beside the slot. */
  chargeKey: Hash32;
  /** On the credit, beside the owner; carried in the claim so the desk can find it without the secret. */
  creditKey: Hash32;
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", copy));
}

/**
 * The secret is the owner's own authorisation signature. It never touches the chain, so the three hashes cannot be
 * joined without it, and a desk that lost its way mid-open re-derives them from the same signature and reads what
 * already landed off the chain. No record, no owner on any slot.
 *
 * ed25519 signatures are deterministic, so one signed text is one seed. A signature that is not 64 bytes of base58 is
 * refused: the route has verified it by then, and this never normalises what the wallet produced.
 */
export async function deriveSlotKeys(authSignature: Signature): Promise<SlotKeys> {
  const raw = decodeBase58(authSignature);
  if (raw?.length !== 64) throw new Error("the authorisation is not a 64-byte signature");
  const seed = await sha256(raw);
  const derive = async (label: string) => {
    const tag = new TextEncoder().encode(label);
    const input = new Uint8Array(seed.length + tag.length);
    input.set(seed);
    input.set(tag, seed.length);
    return keyHex(await sha256(input));
  };
  return { slotId: await derive("slot"), chargeKey: await derive("charge"), creditKey: await derive("credit") };
}
