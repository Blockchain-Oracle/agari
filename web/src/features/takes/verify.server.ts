import { isAddress, isSignature, type Side } from "@agari/core/types";
import { verifyWalletMessage } from "@/lib/auth/verify-signed-message.server";
import { takeMessage } from "./protocol";

/**
 * Whether the signature really is this address's, over the message we would have
 * asked for: ed25519 over the text's exact bytes (D-012). Server only — nothing here
 * may be imported by a component.
 */
export async function verifyTakeSignature(input: { marketId: string; side: Side; caption: string; address: string; issuedAtMs: number; signature: string }): Promise<boolean> {
  if (!isAddress(input.address) || !isSignature(input.signature)) return false;
  return verifyWalletMessage({ text: takeMessage(input), signature: input.signature, signer: input.address });
}
