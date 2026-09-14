import { DEFAULT_CLUSTER, SOLANA_EXPLORER_URL, type Cluster } from "../constants/chain";
import type { Address, Signature } from "../types/primitives";

function clusterQuery(cluster: Cluster): string {
  if (cluster === "mainnet-beta") return "";
  if (cluster === "devnet") return "?cluster=devnet";
  return `?cluster=custom&customUrl=${encodeURIComponent("http://localhost:8899")}`;
}

/** Solana Explorer page for a transaction: the raw proof every receipt links to. */
export function txUrl(signature: Signature, cluster: Cluster = DEFAULT_CLUSTER, explorerBase: string = SOLANA_EXPLORER_URL): string {
  return `${explorerBase}/tx/${signature}${clusterQuery(cluster)}`;
}

export function addressUrl(address: Address, cluster: Cluster = DEFAULT_CLUSTER, explorerBase: string = SOLANA_EXPLORER_URL): string {
  return `${explorerBase}/address/${address}${clusterQuery(cluster)}`;
}
