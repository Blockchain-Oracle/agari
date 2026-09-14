/**
 * The operator client for deploy-time scripts (S2 init-events, later the S3 actors' bootstrap).
 * Server-only: it is built from a keypair's secret bytes, which scripts read from `~/.config/agari/<cluster>/`.
 */
import { agariEventsProgram } from "@agari/clients/agari-events";
import { createClient, createKeyPairSignerFromBytes, createSolanaRpcFromTransport, createSolanaRpcSubscriptions, type KeyPairSigner } from "@solana/kit";
import {
  rpcConnection,
  rpcGetMinimumBalance,
  rpcSubscriptionsConnection,
  rpcTransactionPlanner,
  rpcTransactionPlanSendingExecutor,
  rpcTransactionPlanSigningExecutor,
} from "@solana/kit-plugin-rpc";
import { signer } from "@solana/kit-plugin-signer";
import { systemProgram } from "@solana-program/system";
import { tokenProgram } from "@solana-program/token";
import { retryingRpcTransport } from "./rpc-transport";

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
    // `solanaRpc`'s own composition (kit-plugin-rpc 0.19), with the retrying transport in place of the default one.
    .use(rpcConnection(createSolanaRpcFromTransport(retryingRpcTransport(config.rpcUrl))))
    .use(rpcSubscriptionsConnection(createSolanaRpcSubscriptions(config.rpcSubscriptionsUrl)))
    .use(rpcGetMinimumBalance())
    .use(rpcTransactionPlanner())
    .use(rpcTransactionPlanSigningExecutor())
    .use(rpcTransactionPlanSendingExecutor())
    .use(systemProgram())
    .use(tokenProgram())
    .use(agariEventsProgram());
}

export type DeployClient = Awaited<ReturnType<typeof createDeployClient>>;
