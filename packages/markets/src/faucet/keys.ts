import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseSecretKey } from "../sessions/keypair";

/** The faucet's two server roles (D-034): the SOL source and fee payer, and the tUSDC mint authority. */
export type FaucetRole = "sol-faucet" | "faucet-mint-authority";

export const FAUCET_ROLE_ENV: Record<FaucetRole, string> = {
  "sol-faucet": "SOL_FAUCET_PRIVATE_KEY",
  "faucet-mint-authority": "FAUCET_MINT_AUTHORITY_PRIVATE_KEY",
};

function readSecret(text: string | undefined): Uint8Array | null {
  if (!text) return null;
  try { return parseSecretKey(text); } catch { return null; }
}

/**
 * A role's 64-byte keypair: its env var on a server, else `~/.config/agari/devnet/<role>.json` for local dev
 * (`AGARI_KEYS_DIR` overrides the directory), the same lookup as ops `roleSecret`. Keys are never copied into env
 * files. Null means the faucet reports itself unavailable; the bytes are never logged.
 */
export function faucetRoleSecret(role: FaucetRole, env: Record<string, string | undefined>): Uint8Array | null {
  const fromEnv = readSecret(env[FAUCET_ROLE_ENV[role]]);
  if (fromEnv) return fromEnv;
  const file = join(env.AGARI_KEYS_DIR || join(homedir(), ".config", "agari", "devnet"), `${role}.json`);
  if (!existsSync(file)) return null;
  try { return readSecret(readFileSync(file, "utf8")); } catch { return null; }
}
