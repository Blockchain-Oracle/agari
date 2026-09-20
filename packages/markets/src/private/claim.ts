import { verifySignedMessage, type Ed25519Verify } from "@agari/core/auth";
import { privateClaimMessage, type PrivateClaim } from "@agari/core/private";
import { encodeBase58, type Address, type Signature } from "@agari/core/types";
import { signBytes, type KeyPairSigner } from "@solana/kit";

/** ed25519 with the runtime's own WebCrypto: Node ≥ 22 for the desk, every current browser for the owner. */
const webCryptoEd25519: Ed25519Verify = async (signature, message, publicKey) => {
  const copy = (bytes: Uint8Array) => {
    const out = new Uint8Array(bytes.byteLength);
    out.set(bytes);
    return out;
  };
  const key = await crypto.subtle.importKey("raw", copy(publicKey), { name: "Ed25519" }, false, ["verify"]);
  return crypto.subtle.verify({ name: "Ed25519" }, key, copy(signature), copy(message));
};

/** The desk's signature over a claim: the only proof the position is the owner's. */
export async function signPrivateClaim(desk: KeyPairSigner, contract: Address, chainId: number, claim: PrivateClaim): Promise<Signature> {
  const bytes = new TextEncoder().encode(privateClaimMessage(claim, contract, chainId));
  return encodeBase58(await signBytes(desk.keyPair.privateKey, bytes)) as Signature;
}

/** Runs anywhere: the browser checks a claim against the key the Desk account pins, never against the desk's word. */
export function verifyPrivateClaim(claim: PrivateClaim, signature: Signature, deskKey: Address, contract: Address, chainId: number): Promise<boolean> {
  return verifySignedMessage({ text: privateClaimMessage(claim, contract, chainId), signature, signer: deskKey }, webCryptoEd25519);
}
