import type { Address } from "@agari/core/types";
import { bytesSigner } from "@agari/markets/sessions/mobile";
import type { WalletSession } from "@agari/markets/react";
import { base58FromUint8Array, base64FromUint8Array, base64ToBase58, base64ToUint8Array } from "@solana-mobile/mobile-wallet-adapter-protocol/encoding";
import type { Account, AppIdentity, AuthorizationResult } from "@solana-mobile/mobile-wallet-adapter-protocol";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "agari.mwa.wallet";
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const IDENTITY: AppIdentity = { name: "Agari", uri: "https://useagari.xyz", icon: "favicon.ico" };

export interface MwaState { address: Address; encodedAddress: string; authToken: string }

function accountAddress(account: Account): Address {
  return ("publicKey" in account ? base58FromUint8Array(Uint8Array.from(account.publicKey)) : base64ToBase58(account.address)) as Address;
}
function sessionOf(auth: AuthorizationResult): MwaState {
  const account = auth.accounts[0];
  if (!account) throw new Error("The wallet returned no Solana account.");
  return { address: accountAddress(account), encodedAddress: "publicKey" in account ? base64FromUint8Array(Uint8Array.from(account.publicKey)) : account.address, authToken: auth.auth_token };
}
const assertAndroid = () => { if (Platform.OS !== "android") throw new Error("Mobile Wallet Adapter is available on Android."); };

/** Android's system wallet chooser; the wallet authorizes Agari for Solana devnet. */
export async function connectMwaWallet(): Promise<MwaState> {
  assertAndroid();
  const { transact } = await import("@solana-mobile/mobile-wallet-adapter-protocol");
  const auth = await transact((wallet) => wallet.authorize({ cluster: "devnet", identity: IDENTITY }));
  const state = sessionOf(auth);
  await SecureStore.setItemAsync(KEY, JSON.stringify(state), OPTIONS);
  return state;
}

export async function loadMwaState(): Promise<MwaState | null> {
  const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
  return raw ? JSON.parse(raw) as MwaState : null;
}
export const clearMwaState = () => SecureStore.deleteItemAsync(KEY, OPTIONS);

/** Reauthorize every signing session and refuse an account switch before any signature. */
async function withWallet<T>(state: MwaState, task: (wallet: import("@solana-mobile/mobile-wallet-adapter-protocol").MobileWallet) => Promise<T>): Promise<T> {
  assertAndroid();
  const { transact } = await import("@solana-mobile/mobile-wallet-adapter-protocol");
  return transact(async (wallet) => {
    let auth: AuthorizationResult;
    try { auth = await wallet.reauthorize({ auth_token: state.authToken, identity: IDENTITY }); }
    catch { auth = await wallet.authorize({ cluster: "devnet", identity: IDENTITY }); }
    if (!auth.accounts.some((account) => accountAddress(account) === state.address)) throw new Error("The selected wallet account changed. Reconnect before signing.");
    const refreshed = sessionOf(auth);
    if (refreshed.address === state.address && refreshed.authToken !== state.authToken) {
      state.authToken = refreshed.authToken;
      state.encodedAddress = refreshed.encodedAddress;
      await SecureStore.setItemAsync(KEY, JSON.stringify(state), OPTIONS);
    }
    return task(wallet);
  });
}

export function mwaWalletSession(state: MwaState): WalletSession {
  return {
    address: state.address,
    signer: bytesSigner(state.address as never, async (wire) => withWallet(state, async (wallet) => {
      const result = await wallet.signTransactions({ payloads: wire.map(base64FromUint8Array) });
      return result.signed_payloads.map(base64ToUint8Array);
    })),
    signMessage: async (message) => withWallet(state, async (wallet) => {
      const result = await wallet.signMessages({ addresses: [state.encodedAddress], payloads: [base64FromUint8Array(message)] });
      const signed = result.signed_payloads[0];
      if (!signed) throw new Error("The wallet returned no message signature.");
      const payload = base64ToUint8Array(signed);
      if (payload.length !== message.length + 64 || !message.every((byte, index) => payload[index] === byte)) throw new Error("The wallet returned an unexpected signed message.");
      return payload.slice(message.length);
    }),
  };
}
