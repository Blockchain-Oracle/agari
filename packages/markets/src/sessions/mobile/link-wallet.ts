import type { Address } from "@agari/core/types";
import { getBase58Decoder, getBase58Encoder } from "@solana/kit";
import type { WalletSession } from "../../react/wallet-session";
import { bytesSigner } from "./bytes-signer";
import { boxKeyPairFromSecret, newBoxKeyPair, open, seal, sharedSecret } from "./link-crypto";

/** The wallets that sign over universal-link hand-offs with a devnet cluster (Backpack's links carry no devnet). */
export type LinkWalletName = "phantom" | "solflare";

const BASE: Record<LinkWalletName, string> = { phantom: "https://phantom.app/ul/v1", solflare: "https://solflare.com/ul/v1" };
const WALLET_KEY_PARAM: Record<LinkWalletName, string> = { phantom: "phantom_encryption_public_key", solflare: "solflare_encryption_public_key" };

const b58 = { encode: (bytes: Uint8Array) => getBase58Decoder().decode(bytes), decode: (text: string) => new Uint8Array(getBase58Encoder().encode(text)) };

/** The app's side of a hand-off: open the wallet's link, resolve with the query of the redirect back into the app. */
export interface LinkPort {
  roundTrip(url: string, method: string): Promise<URLSearchParams>;
  /** The app's return link for `method`, e.g. `agari://wallet/<method>`. */
  redirectFor(method: string): string;
}

/** What a connected link wallet needs across launches; the app keeps it in the Keychain / Keystore. */
export interface LinkWalletState {
  wallet: LinkWalletName;
  address: Address;
  session: string;
  dappSecretKey: string;
  walletEncryptionKey: string;
}

export class WalletLinkError extends Error {
  constructor(readonly code: string, message: string) {
    super(code === "4001" ? "User rejected the request." : message);
    this.name = "WalletLinkError";
  }
}

function reply(params: URLSearchParams): { nonce: Uint8Array; data: Uint8Array } {
  const code = params.get("errorCode");
  if (code) throw new WalletLinkError(code, params.get("errorMessage") ?? `wallet error ${code}`);
  const nonce = params.get("nonce");
  const data = params.get("data");
  if (!nonce || !data) throw new Error("the wallet returned without a reply");
  return { nonce: b58.decode(nonce), data: b58.decode(data) };
}

/** `connect` on devnet: the wallet returns its encryption key, the account's address and a session token. */
export async function connectLinkWallet(wallet: LinkWalletName, port: LinkPort, appUrl: string, cluster: "devnet" | "mainnet-beta"): Promise<LinkWalletState> {
  const keys = newBoxKeyPair();
  const query = new URLSearchParams({ app_url: appUrl, dapp_encryption_public_key: b58.encode(keys.publicKey), redirect_link: port.redirectFor("connect"), cluster });
  const params = await port.roundTrip(`${BASE[wallet]}/connect?${query}`, "connect");
  // The wallet's error first: a rejected connect carries no encryption key.
  const { nonce, data } = reply(params);
  const walletKey = params.get(WALLET_KEY_PARAM[wallet]);
  if (!walletKey) throw new Error(`${wallet} returned no encryption key`);
  const connected = open<{ public_key: string; session: string }>(data, nonce, sharedSecret(b58.decode(walletKey), keys.secretKey));
  return { wallet, address: connected.public_key as Address, session: connected.session, dappSecretKey: b58.encode(keys.secretKey), walletEncryptionKey: walletKey };
}

/** The connected link wallet as markets' WalletSession: every signature is one hand-off to the wallet app and back. */
export function linkWalletSession(state: LinkWalletState, port: LinkPort): WalletSession {
  const dapp = boxKeyPairFromSecret(b58.decode(state.dappSecretKey));
  const shared = sharedSecret(b58.decode(state.walletEncryptionKey), dapp.secretKey);

  async function call<T>(method: string, payload: Record<string, unknown>): Promise<T> {
    const sealed = seal({ ...payload, session: state.session }, shared);
    const query = new URLSearchParams({
      dapp_encryption_public_key: b58.encode(dapp.publicKey),
      nonce: b58.encode(sealed.nonce),
      redirect_link: port.redirectFor(method),
      payload: b58.encode(sealed.data),
    });
    const { nonce, data } = reply(await port.roundTrip(`${BASE[state.wallet]}/${method}?${query}`, method));
    return open<T>(data, nonce, shared);
  }

  const signer = bytesSigner(state.address as never, async (wire) => {
    if (wire.length === 1) return [b58.decode((await call<{ transaction: string }>("signTransaction", { transaction: b58.encode(wire[0]!) })).transaction)];
    const out = await call<{ transactions: string[] }>("signAllTransactions", { transactions: wire.map(b58.encode) });
    return out.transactions.map(b58.decode);
  });

  return {
    address: state.address,
    signer,
    signMessage: async (message) => b58.decode((await call<{ signature: string }>("signMessage", { message: b58.encode(message), display: "utf8" })).signature),
  };
}

/** Ends the wallet's session for this app (best effort: the local state is dropped whatever the wallet answers). */
export async function disconnectLinkWallet(state: LinkWalletState, port: LinkPort): Promise<void> {
  const dapp = boxKeyPairFromSecret(b58.decode(state.dappSecretKey));
  const sealed = seal({ session: state.session }, sharedSecret(b58.decode(state.walletEncryptionKey), dapp.secretKey));
  const query = new URLSearchParams({ dapp_encryption_public_key: b58.encode(dapp.publicKey), nonce: b58.encode(sealed.nonce), redirect_link: port.redirectFor("disconnect"), payload: b58.encode(sealed.data) });
  await port.roundTrip(`${BASE[state.wallet]}/disconnect?${query}`, "disconnect").catch(() => undefined);
}
