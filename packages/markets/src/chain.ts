import { DEFAULT_CLUSTER, SOLANA_EXPLORER_URL } from "@agari/core/constants";
import { DEVNET_DEFAULTS } from "./env";

/** The cluster Agari targets (plan §0). Explorer links carry it: build them with core `txUrl`/`addressUrl`. */
export const CLUSTER = DEFAULT_CLUSTER;
export const RPC_HTTP_URLS: readonly string[] = DEVNET_DEFAULTS.rpcHttpUrls;
export const RPC_WS_URLS: readonly string[] = DEVNET_DEFAULTS.rpcWsUrls;
export const EXPLORER_URL = SOLANA_EXPLORER_URL;
