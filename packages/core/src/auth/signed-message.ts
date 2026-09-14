import { z } from "zod";
import { CLUSTER_LABEL, type Cluster } from "../constants/chain";
import { decodeBase58 } from "../types/base58";
import { isSignature, type Address, type Signature } from "../types/primitives";

/**
 * Every text Agari asks a wallet (or a browser key) to sign, and how a server checks it.
 *
 * A Solana wallet signs raw bytes with ed25519 (Wallet Standard `solana:signMessage`, Privy `signMessage`). There is
 * no EIP-191 prefix: the signature covers exactly the UTF-8 bytes of the text. So the browser and the server must
 * build the same string from the same fields, byte for byte, and the text must be written to be READ: it names what
 * the signature allows and what it doesn't, because people sign what they can understand.
 *
 * Core carries no crypto. The verifier is passed in (WebCrypto `Ed25519` or `@noble/curves` on the server), the same
 * shape `verifyDeckCommitment` uses for keccak. ed25519 signatures are deterministic (RFC 8032), which the private
 * desk relies on when it derives a bet's keys from the signature.
 */

export const SIGNED_MESSAGE_BRAND = "Agari";

/** The line that binds a signed text to one cluster, so a devnet signature is never a mainnet one. */
export function networkLine(cluster: Cluster): string {
  return `Network: ${CLUSTER_LABEL[cluster]}`;
}

/** WHATWG TextEncoder: global in every runtime Agari targets (browsers, Node, workers); declared here because core compiles with no DOM or Node lib. */
declare const TextEncoder: new () => { encode(input: string): Uint8Array };

const encoder = new TextEncoder();

/** The exact bytes a wallet signs for `text`. */
export function messageBytes(text: string): Uint8Array {
  return encoder.encode(text);
}

/** An ed25519 check over raw bytes: signature (64 B), message, public key (32 B). */
export type Ed25519Verify = (signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array) => boolean | Promise<boolean>;

export interface SignedMessage {
  text: string;
  /** base58 of the 64 signature bytes, as the browser sends it. */
  signature: Signature;
  signer: Address;
}

/** On the wire a message signature is base58, exactly like a transaction signature. */
export const messageSignatureSchema = z.custom<Signature>(isSignature, "expected a base58 ed25519 signature");

/**
 * True only when `signature` is `signer`'s ed25519 signature over `text`. Malformed base58 is a plain false, never a
 * throw, so a route can answer 401 without a try/catch around attacker input.
 */
export async function verifySignedMessage(message: SignedMessage, verify: Ed25519Verify): Promise<boolean> {
  const signature = decodeBase58(message.signature);
  const publicKey = decodeBase58(message.signer);
  if (signature?.length !== 64 || publicKey?.length !== 32) return false;
  try {
    return await verify(signature, messageBytes(message.text), publicKey);
  } catch {
    return false;
  }
}
