import { createSolanaRpc } from "@solana/kit";
import { DEVNET_DEFAULTS } from "../env";
import { getClient } from "../runtime/read-runtime";
import type { WriteRpc } from "./steps/message";

let built: { url: string; rpc: WriteRpc } | null = null;

/** The RPC a write lane uses when its session was given none: the read runtime's endpoint (interim until S4a.1). */
export function writeRpc(): WriteRpc {
  let url: string = DEVNET_DEFAULTS.rpcHttpUrls[0];
  try {
    url = getClient().rpcHttpUrl;
  } catch {
    // not configured: a script on the devnet defaults
  }
  if (built?.url !== url) built = { url, rpc: createSolanaRpc(url) };
  return built.rpc;
}
