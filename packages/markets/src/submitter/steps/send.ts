import type { Base64EncodedWireTransaction } from "@solana/kit";
import { preflightFailure } from "../chain-failure";
import { SimulationFailedError } from "../errors";
import type { WriteRpc } from "./message";

/**
 * The first broadcast of signed bytes, with preflight at `confirmed` (first-call.md §3.1). A preflight refusal means the
 * RPC never forwarded the transaction, so it throws `SimulationFailedError` and the lane maps it like a simulation.
 * Any other failure (a dropped socket, a 429) leaves it unknown whether the bytes left: the confirm loop re-sends them.
 */
export async function sendStep(rpc: WriteRpc, wire: Base64EncodedWireTransaction): Promise<{ accepted: boolean; error?: unknown }> {
  try {
    await rpc.sendTransaction(wire, { encoding: "base64", preflightCommitment: "confirmed" }).send();
    return { accepted: true };
  } catch (error) {
    const failure = preflightFailure(error);
    if (failure) throw new SimulationFailedError(failure, "preflight");
    return { accepted: false, error };
  }
}

/** A re-broadcast of the same bytes while confirming: no preflight, no RPC-side retries; a duplicate is not an error. */
export async function resendStep(rpc: WriteRpc, wire: Base64EncodedWireTransaction): Promise<void> {
  try {
    await rpc.sendTransaction(wire, { encoding: "base64", skipPreflight: true, maxRetries: 0n }).send();
  } catch {
    // "already processed", a 429 or a dropped socket: the status poll decides, never this call.
  }
}
