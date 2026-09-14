/** The Solana clusters Agari runs on. Devnet is the target (plan §0); localnet is Surfpool. */
export type Cluster = "mainnet-beta" | "devnet" | "localnet";

export const DEFAULT_CLUSTER: Cluster = "devnet";

/**
 * Numeric cluster ids, for the fields Masayume bound to an EVM chain id (deck commitments, room tokens, desk
 * messages), so a signature or commitment for one cluster never verifies on another. 101 and 103 follow
 * Solana's own convention (SPL token-list); localnet takes 104 so it can never collide with a real cluster.
 */
export const CLUSTER_ID: Readonly<Record<Cluster, number>> = { "mainnet-beta": 101, devnet: 103, localnet: 104 };

export const CLUSTER_LABEL: Readonly<Record<Cluster, string>> = {
  "mainnet-beta": "Solana mainnet",
  devnet: "Solana devnet",
  localnet: "Solana localnet",
};

export function clusterOfId(id: number): Cluster | null {
  return (Object.keys(CLUSTER_ID) as Cluster[]).find((cluster) => CLUSTER_ID[cluster] === id) ?? null;
}

/** "Solana devnet" for a known id; the bare number otherwise, so a signed text never names a cluster it isn't. */
export function clusterLabelOfId(id: number): string {
  const cluster = clusterOfId(id);
  return cluster ? CLUSTER_LABEL[cluster] : `cluster ${id}`;
}

export const SOLANA_EXPLORER_URL = "https://explorer.solana.com";
