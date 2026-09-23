import type { LinkWalletState } from "@agari/markets/sessions/mobile";
import * as SecureStore from "expo-secure-store";

const KEY = "agari.link.wallet";
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

/** The connected link wallet's session and encryption keys, in the Keychain / Keystore on this device only. */
export async function loadLinkState(): Promise<LinkWalletState | null> {
  const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
  return raw ? (JSON.parse(raw) as LinkWalletState) : null;
}

export const saveLinkState = (state: LinkWalletState) => SecureStore.setItemAsync(KEY, JSON.stringify(state), OPTIONS);
export const clearLinkState = () => SecureStore.deleteItemAsync(KEY, OPTIONS);
