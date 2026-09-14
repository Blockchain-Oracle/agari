/**
 * The venue actors' shared environment (venue-ops.md §2). Read once at boot. Provider keys ride inside RPC URLs,
 * so every log line that might carry a URL or error text goes through `redact` first.
 */
export type OpsCluster = "devnet" | "localnet";

export interface OpsEnv {
  cluster: OpsCluster;
  /** HTTP RPC; may carry the Helius key. Never log it. */
  rpcUrl: string;
  rpcSubscriptionsUrl: string;
  /** True unless `DRY_RUN=0|false`: actors read, plan and log what they would send, and never sign. */
  dryRun: boolean;
  /** `/health` and the spot SSE. */
  httpPort: number;
}

const DEFAULT_HTTP_PORT = 8787;

export function readOpsEnv(env: NodeJS.ProcessEnv = process.env): OpsEnv {
  const cluster: OpsCluster = env.SOLANA_CLUSTER === "localnet" ? "localnet" : "devnet";
  const helius = env.HELIUS_API_KEY;
  const local = { http: `http://127.0.0.1:${env.SURFPOOL_PORT ?? 8899}`, ws: `ws://127.0.0.1:${env.SURFPOOL_WS_PORT ?? 8900}` };
  const devnet = helius
    ? { http: `https://devnet.helius-rpc.com/?api-key=${helius}`, ws: `wss://devnet.helius-rpc.com/?api-key=${helius}` }
    : { http: "https://api.devnet.solana.com", ws: "wss://api.devnet.solana.com" };
  const urls = cluster === "localnet" ? local : devnet;
  const port = Number(env.OPS_HTTP_PORT ?? env.PORT);
  return {
    cluster,
    rpcUrl: env.SOLANA_RPC_URL || urls.http,
    rpcSubscriptionsUrl: env.SOLANA_WS_URL || urls.ws,
    dryRun: !(env.DRY_RUN === "0" || env.DRY_RUN === "false"),
    httpPort: Number.isInteger(port) && port > 0 ? port : DEFAULT_HTTP_PORT,
  };
}

const SECRET_ENV = ["HELIUS_API_KEY", "PYTH_API_KEY", "ALPACA_KEY_ID", "ALPACA_SECRET_KEY", "FINNHUB_API_KEY", "JUPITER_API_KEY", "STORK_API_KEY"];

/** Replaces every configured provider secret in `text` with `<NAME>`. */
export function redact(text: string, env: NodeJS.ProcessEnv = process.env): string {
  let out = text;
  for (const name of SECRET_ENV) {
    const value = env[name];
    if (value && value.length >= 8) out = out.replaceAll(value, `<${name}>`);
  }
  return out;
}

export const errorText = (error: unknown): string => redact(error instanceof Error ? error.message : String(error));
