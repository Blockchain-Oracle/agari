/**
 * The operator client for deploy-time scripts (S2 init-events, later the S3 actors' bootstrap).
 * Server-only: it is built from a keypair's secret bytes, which scripts read from `~/.config/agari/<cluster>/`.
 */
import { agariEventsProgram } from "@agari/clients/agari-events";
import { createClient, createKeyPairSignerFromBytes, type KeyPairSigner } from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { signer } from "@solana/kit-plugin-signer";
import { systemProgram } from "@solana-program/system";
import { tokenProgram } from "@solana-program/token";

export type DeployClientConfig = {
  /** HTTP RPC endpoint. May carry a provider key: never log it. */
  rpcUrl: string;
  rpcSubscriptionsUrl: string;
  /** 64-byte Solana CLI keypair (seed + public key) of the fee payer, which is also the identity. */
  payerSecret: Uint8Array;
};

export async function keypairSigner(secret: Uint8Array): Promise<KeyPairSigner> {
  if (secret.length !== 64) throw new Error(`expected a 64-byte keypair, got ${secret.length} bytes`);
  return createKeyPairSignerFromBytes(secret);
}

export async function createDeployClient(config: DeployClientConfig) {
  const payer = await keypairSigner(config.payerSecret);
  return createClient()
    .use(signer(payer))
    .use(solanaRpc({ rpcUrl: config.rpcUrl, rpcSubscriptionsUrl: config.rpcSubscriptionsUrl }))
    .use(systemProgram())
    .use(tokenProgram())
    .use(agariEventsProgram());
}

export type DeployClient = Awaited<ReturnType<typeof createDeployClient>>;
