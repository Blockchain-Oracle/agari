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
import { Agent, interceptors, type Dispatcher } from "undici";

export type DeployClientConfig = {
  /** HTTP RPC endpoint. May carry a provider key: never log it. */
  rpcUrl: string;
  rpcSubscriptionsUrl: string;
  /** 64-byte Solana CLI keypair (seed + public key) of the fee payer, which is also the identity. */
  payerSecret: Uint8Array;
};

/**
 * One process-wide HTTP dispatcher for JSON-RPC (the S3 soak hit Helius devnet 429s and half-closed keep-alive
 * sockets): bounded connections per origin, header/body timeouts, and retries with backoff on 429/5xx and socket
 * resets. Retrying a `sendTransaction` is safe: a duplicate signature is deduplicated by the cluster, and actors
 * reconcile from chain state before acting again.
 */
let rpcDispatcher: Dispatcher | undefined;
export function rpcHttpDispatcher(): Dispatcher {
  rpcDispatcher ??= new Agent({ connections: 16, headersTimeout: 30_000, bodyTimeout: 30_000, keepAliveTimeout: 4_000 }).compose(
    interceptors.retry({
      maxRetries: 6,
      minTimeout: 500,
      maxTimeout: 8_000,
      timeoutFactor: 2,
      methods: ["POST", "GET"],
      statusCodes: [429, 500, 502, 503, 504],
      errorCodes: ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "ENETUNREACH", "EHOSTUNREACH", "UND_ERR_SOCKET"],
    }),
  );
  return rpcDispatcher;
}

export async function keypairSigner(secret: Uint8Array): Promise<KeyPairSigner> {
  if (secret.length !== 64) throw new Error(`expected a 64-byte keypair, got ${secret.length} bytes`);
  return createKeyPairSignerFromBytes(secret);
}

export async function createDeployClient(config: DeployClientConfig) {
  const payer = await keypairSigner(config.payerSecret);
  return createClient()
    .use(signer(payer))
    .use(solanaRpc({ rpcUrl: config.rpcUrl, rpcSubscriptionsUrl: config.rpcSubscriptionsUrl, rpcConfig: { dispatcher_NODE_ONLY: rpcHttpDispatcher() as never } }))
    .use(systemProgram())
    .use(tokenProgram())
    .use(agariEventsProgram());
}

export type DeployClient = Awaited<ReturnType<typeof createDeployClient>>;
