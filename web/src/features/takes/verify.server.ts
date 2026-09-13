import type { Side } from "@masayume/core/types";
import { verifyMessage } from "viem";
import { takeMessage } from "./protocol";

/**
 * Whether the signature really is this address's, over the message we would have
 * asked for. Server only — nothing here may be imported by a component.
 */
export async function verifyTakeSignature(input: { marketId: string; side: Side; caption: string; address: string; issuedAtMs: number; signature: string }): Promise<boolean> {
  try {
    return await verifyMessage({
      address: input.address as `0x${string}`,
      message: takeMessage(input),
      signature: input.signature as `0x${string}`,
    });
  } catch {
    return false;
  }
}
