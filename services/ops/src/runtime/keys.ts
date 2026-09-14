import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readSecretKey } from "../actors/secret-key";

/** The S3 venue roles (scripts/deploy/roles.mjs). */
export type OpsRole = "roller" | "price-relay" | "price-attestor" | "settler" | "maker" | "faucet-mint-authority";

/** `price-relay` → `PRICE_RELAY_PRIVATE_KEY`. */
export const roleEnvName = (role: OpsRole) => `${role.replaceAll("-", "_").toUpperCase()}_PRIVATE_KEY`;

/**
 * A role's 64-byte keypair: the `<ROLE>_PRIVATE_KEY` env var (Fly), else `~/.config/agari/devnet/<role>.json`
 * (`AGARI_KEYS_DIR` overrides the directory). Null means scan-and-report: never a guessed or shared signer.
 */
export function roleSecret(role: OpsRole, env: NodeJS.ProcessEnv = process.env): Uint8Array | null {
  const fromEnv = readSecretKey(env[roleEnvName(role)]);
  if (fromEnv) return fromEnv;
  const file = join(env.AGARI_KEYS_DIR ?? join(homedir(), ".config", "agari", "devnet"), `${role}.json`);
  return existsSync(file) ? readSecretKey(readFileSync(file, "utf8")) : null;
}
