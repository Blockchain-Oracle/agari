import { somniaShannon } from "@somnia-chain/markets-sdk/chains";

/** The viem chain web hands to wagmi. Carries both HTTP and both WebSocket endpoints for rotate-on-failure. */
export const SOMNIA_SHANNON = somniaShannon;
export const SOMNIA_SHANNON_ID = somniaShannon.id;
export const RPC_HTTP_URLS: readonly string[] = somniaShannon.rpcUrls.default.http;
export const RPC_WS_URLS: readonly string[] = somniaShannon.rpcUrls.default.webSocket ?? [];
export const EXPLORER_URL = somniaShannon.blockExplorers.default.url;
export const MULTICALL3_ADDRESS = somniaShannon.contracts.multicall3.address;
