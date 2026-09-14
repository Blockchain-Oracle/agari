import { createClient } from "@solana/kit";
import { walletWithoutSigner } from "@solana/kit-plugin-wallet";
import { WALLET_CHAIN } from "../solana-client";

/**
 * The app's one wallet client (D-023): Anza's Kit wallet plugin over Wallet Standard, so every installed Solana wallet
 * (Phantom, Solflare, Backpack, …) is discovered without a vendor SDK, an app id or a dashboard.
 *
 * `walletWithoutSigner` because markets owns fee payers and sends (only `packages/markets` sends transactions): this
 * client only discovers, connects, remembers the last wallet (auto-reconnect) and exposes the connected account's
 * signer. It is safe on the server, where its status stays `pending` and no storage or registry is touched.
 */
export const walletClient = createClient().use(walletWithoutSigner({ chain: WALLET_CHAIN, storageKey: "agari.wallet" }));

export type WalletClient = typeof walletClient;
