import { createKeyPairSignerFromBytes, type KeyPairSigner } from "@solana/kit";
import { SECRET_KEY_BYTES } from "./keypair";

/**
 * A `{ secretKey }` session's Kit signer (first-call.md §3.4): ops actors, drives, the duel's session key. Kit checks the
 * public half against the seed before anything signs. Server and script only; a browser wallet never reaches here.
 */
export async function keypairSigner(secretKey: Uint8Array): Promise<KeyPairSigner> {
  if (secretKey.length !== SECRET_KEY_BYTES) throw new Error(`expected a ${SECRET_KEY_BYTES}-byte Solana keypair`);
  return createKeyPairSignerFromBytes(secretKey);
}
