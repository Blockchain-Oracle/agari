import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEVNET_DEFAULTS } from "../env";
import { parseSecretKey } from "../sessions/keypair";

export const PROOF_REPLAY_ROLE = "proof-replay";
export const PROOF_REPLAY_KEY_ENV = "PROOF_REPLAY_PRIVATE_KEY";

/**
 * The `proof-replay` role's 64-byte keypair (D-041): `PROOF_REPLAY_PRIVATE_KEY` on a server, else
 * `~/.config/agari/devnet/proof-replay.json` (`AGARI_KEYS_DIR` overrides the directory), the faucet's lookup (D-034).
 * Never `price-relay`: the relay's hourly sweep closes every price update its key wrote. The bytes are never logged.
 */
export function proofReplaySecret(env: Record<string, string | undefined>): Uint8Array | null {
  const text = env[PROOF_REPLAY_KEY_ENV] || readRoleFile(env.AGARI_KEYS_DIR || join(homedir(), ".config", "agari", "devnet"));
  if (!text) return null;
  try {
    return parseSecretKey(text);
  } catch {
    return null;
  }
}

function readRoleFile(dir: string): string | null {
  const file = join(dir, `${PROOF_REPLAY_ROLE}.json`);
  if (!existsSync(file)) return null;
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

/** The replay's RPC: `PROOF_REPLAY_RPC_URL`, else public devnet (a handful of sends per boundary; the ops Helius budget stays with ops, D-030). */
export function proofReplayRpcUrl(env: Record<string, string | undefined>): string {
  return env.PROOF_REPLAY_RPC_URL?.trim() || DEVNET_DEFAULTS.rpcHttpUrls[0];
}
