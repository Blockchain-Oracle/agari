import * as SecureStore from "expo-secure-store";

const SEED_KEY = "agari.practice.seed";
/** This device only, while unlocked: never synced to iCloud Keychain or restored from a backup onto another phone. */
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], (h) => Number.parseInt(h, 16));

/** The practice wallet's 32-byte seed, created on first use. */
export async function practiceSeed(): Promise<Uint8Array> {
  const stored = await SecureStore.getItemAsync(SEED_KEY, OPTIONS);
  if (stored) return fromHex(stored);
  const seed = crypto.getRandomValues(new Uint8Array(32));
  await SecureStore.setItemAsync(SEED_KEY, toHex(seed), OPTIONS);
  return seed;
}

export async function hasPracticeSeed(): Promise<boolean> {
  return (await SecureStore.getItemAsync(SEED_KEY, OPTIONS)) !== null;
}
