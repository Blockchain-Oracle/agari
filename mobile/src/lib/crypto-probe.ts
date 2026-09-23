import { generateSessionKey } from "@agari/markets/sessions";

/** S26.0: the WebCrypto path Kit and the session key depend on — Ed25519 generate, address derivation, sign, verify. */
export async function probeCrypto(): Promise<string> {
  const key = await generateSessionKey();
  const message = new TextEncoder().encode("agari mobile probe");
  const signature = await crypto.subtle.sign("Ed25519", key.keyPair.privateKey, message);
  const verified = await crypto.subtle.verify("Ed25519", key.keyPair.publicKey, signature, message);
  if (!verified) throw new Error("Ed25519 signature did not verify");
  return key.address;
}
