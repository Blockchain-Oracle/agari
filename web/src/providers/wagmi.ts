import { RPC_HTTP_URLS, SOMNIA_SHANNON } from "@masayume/markets/chain";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  braveWallet,
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { cookieStorage, createConfig, createStorage, fallback, http } from "wagmi";
import { BRAND } from "@/lib/copy";
import { webEnv } from "@/lib/env";

/**
 * Only WalletConnect-backed wallets ever read the projectId; the injected-only group never instantiates one,
 * so this sentinel merely satisfies the type and keeps the zero-env boot honest (AD-7).
 */
const NO_WALLETCONNECT_PROJECT = "masayume-injected-only";

export const WALLET_CONNECT_ENABLED = Boolean(webEnv.walletConnectProjectId);

function walletGroups() {
  const browser = { groupName: "Browser", wallets: [injectedWallet, rabbyWallet, braveWallet] };
  if (!WALLET_CONNECT_ENABLED) return [browser];
  return [browser, { groupName: "Mobile & more", wallets: [metaMaskWallet, walletConnectWallet, rainbowWallet] }];
}

export const wagmiConfig = createConfig({
  chains: [SOMNIA_SHANNON],
  connectors: connectorsForWallets(walletGroups(), {
    appName: BRAND.name,
    projectId: webEnv.walletConnectProjectId ?? NO_WALLETCONNECT_PROJECT,
  }),
  // ssr + cookie storage: the server and the first client render both see "disconnected", then wagmi reconnects
  // from the cookie after hydration — no mismatch, and no per-request cookie plumbing in the layout.
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
  transports: { [SOMNIA_SHANNON.id]: fallback(RPC_HTTP_URLS.map((url) => http(url))) },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
