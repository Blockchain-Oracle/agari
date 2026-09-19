/**
 * The operator client for deploy-time scripts (S2 init-events, later the S3 actors' bootstrap).
 * Server-only: it is built from a keypair's secret bytes, which scripts read from `~/.config/agari/<cluster>/`.
 */
import { agariEventsProgram } from "@agari/clients/agari-events";
import { agariRangeProgram } from "@agari/clients/agari-range";
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
import { retryingRpcTransport, type RpcLane } from "./rpc-transport";

export type DeployClientConfig = {
  /** HTTP RPC endpoint. May carry a provider key: never log it. */
  rpcUrl: string;
  rpcSubscriptionsUrl: string;
  /** 64-byte Solana CLI keypair (seed + public key) of the fee payer, which is also the identity. */
  payerSecret: Uint8Array;
  /** The pacing lane (`rpc-transport.ts`); price-relay uses `priority`. */
  rpcLane?: RpcLane;
  /** Send without preflight, so a transaction the program refuses still lands as a failed one (drive evidence only). */
  skipPreflight?: boolean;
};

export async function keypairSigner(secret: Uint8Array): Promise<KeyPairSigner> {
  if (secret.length !== 64) throw new Error(`expected a 64-byte keypair, got ${secret.length} bytes`);
  return createKeyPairSignerFromBytes(secret);
}

/**
 * One RPC Subscriptions instance per URL for the whole process: Kit pools every client's confirmation subscriptions
 * onto shared websockets instead of one socket per role client (Helius refused extra connections in the S3 soak).
 */
const subscriptionsByUrl = new Map<string, ReturnType<typeof createSolanaRpcSubscriptions>>();
function sharedSubscriptions(url: string) {
  let subscriptions = subscriptionsByUrl.get(url);
  if (!subscriptions) subscriptionsByUrl.set(url, (subscriptions = createSolanaRpcSubscriptions(url)));
  return subscriptions;
}

export async function createDeployClient(config: DeployClientConfig) {
  const payer = await keypairSigner(config.payerSecret);
  return createClient()
    .use(signer(payer))
    // `solanaRpc`'s own composition (kit-plugin-rpc 0.19), with the retrying transport in place of the default one.
    .use(rpcConnection(createSolanaRpcFromTransport(retryingRpcTransport(config.rpcUrl, config.rpcLane))))
    .use(rpcSubscriptionsConnection(sharedSubscriptions(config.rpcSubscriptionsUrl)))
    .use(rpcGetMinimumBalance())
    .use(rpcTransactionPlanner())
    .use(rpcTransactionPlanSigningExecutor())
    .use(rpcTransactionPlanSendingExecutor({ skipPreflight: config.skipPreflight ?? false }))
    .use(systemProgram())
    .use(tokenProgram())
    .use(agariEventsProgram())
    .use(agariRangeProgram());
}

export type DeployClient = Awaited<ReturnType<typeof createDeployClient>>;
