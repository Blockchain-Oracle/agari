/**
 * The Kit RPC and subscriptions every browser read and user send goes through (first-call.md §1, §2.1). Built once
 * per read-runtime generation from `NEXT_PUBLIC_SOLANA_RPC_URL` / `_WS_URL` (public devnet by default, never a
 * provider key), over the paced transport. Subscriptions open no socket until the first subscribe, and Kit pools
 * every subscription onto one websocket per tab.
 */
import type { Cluster } from "@agari/core/constants";
import {
  createSolanaRpcFromTransport,
  createSolanaRpcSubscriptions,
  type Rpc,
  type RpcSubscriptions,
  type SolanaRpcApi,
  type SolanaRpcSubscriptionsApi,
} from "@solana/kit";
import { DEVNET_DEFAULTS } from "../env";
import { exchangeVersion, peekClient } from "./read-runtime";
import { pacedRpcTransport } from "./transport";

export interface SolanaRuntime {
  rpc: Rpc<SolanaRpcApi>;
  subscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
  cluster: Cluster;
}

let built: { version: number; runtime: SolanaRuntime } | null = null;

/** The configured endpoints, or the devnet defaults before `configureMarkets` (scripts, tests). */
export function solana(): SolanaRuntime {
  const version = exchangeVersion();
  if (built?.version === version) return built.runtime;
  const client = peekClient();
  const rpcUrl = client?.rpcHttpUrl ?? DEVNET_DEFAULTS.rpcHttpUrls[0];
  const wsUrl = client?.rpcWsUrl ?? DEVNET_DEFAULTS.rpcWsUrls[0];
  const runtime: SolanaRuntime = {
    rpc: createSolanaRpcFromTransport(pacedRpcTransport(rpcUrl)),
    subscriptions: createSolanaRpcSubscriptions(wsUrl as Parameters<typeof createSolanaRpcSubscriptions>[0]),
    cluster: client?.cluster ?? DEVNET_DEFAULTS.cluster,
  };
  built = { version, runtime };
  return runtime;
}

/** Bumps with the read runtime, so module caches keyed on it drop everything read from a previous cluster. */
export function solanaGeneration(): number {
  return exchangeVersion();
}
