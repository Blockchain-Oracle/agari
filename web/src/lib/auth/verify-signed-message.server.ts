import { verifySignedMessage, type Ed25519Verify, type SignedMessage } from "@agari/core/auth";

/**
 * ed25519 over raw bytes with the runtime's own WebCrypto (Node ≥ 22 and every edge runtime support `Ed25519`), so the
 * server adds no crypto dependency. A key that won't import (not 32 bytes, not a curve point) is a plain false.
 */
export const webCryptoEd25519: Ed25519Verify = async (signature, message, publicKey) => {
  const key = await crypto.subtle.importKey("raw", toBuffer(publicKey), { name: "Ed25519" }, false, ["verify"]);
  return crypto.subtle.verify({ name: "Ed25519" }, key, toBuffer(signature), toBuffer(message));
};

/** True only when `signature` is `signer`'s ed25519 signature over exactly `text` (D-012). Never throws on input. */
export function verifyWalletMessage(message: SignedMessage): Promise<boolean> {
  return verifySignedMessage(message, webCryptoEd25519);
}

/** WebCrypto wants an ArrayBuffer-backed view; copying keeps SharedArrayBuffer-backed input out. */
function toBuffer(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}
