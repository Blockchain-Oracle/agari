import { install } from "react-native-quick-crypto";
import { SITE_URL } from "./lib/env";
import { storage } from "./lib/storage";

// Patches global.crypto (getRandomValues + subtle with Ed25519) and global.Buffer.
install();

/**
 * Web Storage over MMKV: the submitter's intent journal and web's small remembered choices persist across launches
 * as they do in a browser (synchronous, string values), instead of falling back to memory.
 */
if (typeof globalThis.localStorage === "undefined") {
  const PREFIX = "ls:";
  const keys = () => storage.getAllKeys().filter((k) => k.startsWith(PREFIX));
  const local: Storage = {
    get length() {
      return keys().length;
    },
    key: (index) => keys()[index]?.slice(PREFIX.length) ?? null,
    getItem: (key) => storage.getString(PREFIX + key) ?? null,
    setItem: (key, value) => storage.set(PREFIX + key, String(value)),
    removeItem: (key) => void storage.remove(PREFIX + key),
    clear: () => keys().forEach((k) => storage.remove(k)),
  };
  Object.defineProperty(globalThis, "localStorage", { value: local, configurable: true });
}

/**
 * Web's hooks call their own API by path (`/api/faucet`, `/api/index/...`): a page resolves that against its origin,
 * a phone has none, so a path resolves against the production web app (EXPO_PUBLIC_SITE_URL in development).
 */
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
  nativeFetch(typeof input === "string" && input.startsWith("/") ? `${SITE_URL}${input}` : input, init);
