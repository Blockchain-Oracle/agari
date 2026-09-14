import { DEFAULT_CLUSTER, type Cluster } from "@agari/core/constants";
import { webEnv } from "@/lib/env";

/**
 * Where the browser talks to Solana. The URLs are public devnet by default; the Helius key never reaches the browser
 * (S4 decides between `/api/rpc` and an allowlisted endpoint).
 */
export const SOLANA_CLUSTER: Cluster = DEFAULT_CLUSTER;
export const SOLANA_RPC_URL = webEnv.solanaRpcUrl;
export const SOLANA_WS_URL = webEnv.solanaWsUrl;

/**
 * The Wallet Standard chain the wallet list is filtered by. Wallets advertise `solana:mainnet` and `solana:devnet`
 * (few advertise localnet), so Surfpool drives sign as devnet: the chain only picks which wallets are offered.
 */
export type WalletChain = "solana:mainnet" | "solana:devnet";

export function walletChainOf(cluster: Cluster): WalletChain {
  return cluster === "mainnet-beta" ? "solana:mainnet" : "solana:devnet";
}

export const WALLET_CHAIN: WalletChain = walletChainOf(SOLANA_CLUSTER);
