import { generateKeyPairSync } from "node:crypto";
import { createOpsClient, type OpsClient } from "@agari/markets/ops";
import type { OpsEnv, OpsRole } from "../../runtime";
import { roleSecret } from "../../runtime";

/** A throwaway 64-byte keypair: lets a key-less actor read the chain without ever holding a real signer. */
function ephemeralSecret(): Uint8Array {
  const jwk = generateKeyPairSync("ed25519").privateKey.export({ format: "jwk" });
  return Uint8Array.from([...Buffer.from(jwk.d!, "base64url"), ...Buffer.from(jwk.x!, "base64url")]);
}

/**
 * The role's client, or a read-only one when its key is missing (spec §1: scan-and-report). `signing` false forces
 * DRY behaviour whatever `DRY_RUN` says.
 */
export async function roleClient(env: OpsEnv, role: OpsRole): Promise<{ client: OpsClient; signing: boolean }> {
  const secret = roleSecret(role);
  const client = await createOpsClient({ rpcUrl: env.rpcUrl, rpcSubscriptionsUrl: env.rpcSubscriptionsUrl, payerSecret: secret ?? ephemeralSecret() });
  return { client, signing: secret !== null };
}
