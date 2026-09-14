import { DEFAULT_CLUSTER, type Cluster } from "@agari/core/constants";
import { webEnv } from "@/lib/env";

/**
 * Where the browser talks to Solana, with no SDK import: `@solana/kit` is loaded only inside the lazy Privy island,
 * so routes that never open a wallet never download it. The URLs are public devnet by default; the Helius key never
 * reaches the browser (S4 decides between `/api/rpc` and an allowlisted endpoint).
 */
export const SOLANA_CLUSTER: Cluster = DEFAULT_CLUSTER;
export const SOLANA_RPC_URL = webEnv.solanaRpcUrl;
export const SOLANA_WS_URL = webEnv.solanaWsUrl;

/** Privy's wallet-standard chain ids. Privy has no localnet chain; Surfpool drives sign as devnet (the chain id only picks Privy's UI RPC). */
export type PrivySolanaChain = "solana:mainnet" | "solana:devnet";

export function privyChainOf(cluster: Cluster): PrivySolanaChain {
  return cluster === "mainnet-beta" ? "solana:mainnet" : "solana:devnet";
}

export const PRIVY_SOLANA_CHAIN: PrivySolanaChain = privyChainOf(SOLANA_CLUSTER);
