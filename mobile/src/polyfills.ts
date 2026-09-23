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

/**
 * AbortSignal.timeout / AbortSignal.any: web's readers (leaderboard, the gas client) bound their fetches with them;
 * Hermes ships AbortController without these two statics.
 */
const Signal = globalThis.AbortSignal as typeof AbortSignal & { timeout?: unknown; any?: unknown };
if (Signal && typeof Signal.timeout !== "function") {
  Signal.timeout = (ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error("The operation timed out.")), ms);
    return controller.signal;
  };
}
if (Signal && typeof Signal.any !== "function") {
  Signal.any = (signals: AbortSignal[]) => {
    const controller = new AbortController();
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort(signal.reason);
        break;
      }
      signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
    }
    return controller.signal;
  };
}

/**
 * The slice of `window` web hooks touch outside a browser: an empty query string (a phone route carries its params
 * in the router, not the URL), and window-level events (web announces X-account changes by dispatching one).
 */
const win = globalThis as unknown as { location?: unknown; addEventListener?: unknown; removeEventListener?: unknown; dispatchEvent?: unknown };
if (!win.location) win.location = { search: "", hash: "", pathname: "/", href: SITE_URL, origin: SITE_URL, host: new URL(SITE_URL).host };
if (typeof win.addEventListener !== "function") {
  type Listener = (event: { type: string }) => void;
  const listeners = new Map<string, Set<Listener>>();
  win.addEventListener = (type: string, listener: Listener) => void listeners.set(type, (listeners.get(type) ?? new Set()).add(listener));
  win.removeEventListener = (type: string, listener: Listener) => void listeners.get(type)?.delete(listener);
  win.dispatchEvent = (event: { type: string }) => {
    listeners.get(event.type)?.forEach((listener) => listener(event));
    return true;
  };
}
// web announces changes with `new CustomEvent(type, { detail })`; Hermes may not define it.
if (typeof (globalThis as { CustomEvent?: unknown }).CustomEvent !== "function") {
  (globalThis as { CustomEvent?: unknown }).CustomEvent = class {
    readonly detail: unknown;
    constructor(readonly type: string, init?: { detail?: unknown }) {
      this.detail = init?.detail;
    }
  };
}

/**
 * Dev only: React 19.2's development renderer logs changed props for its performance tracks with JSON.stringify,
 * which throws on a bigint and wedges the renderer ("Should not already be working"). Money here is bigint by rule, so
 * a prop like a quote's bigint[] would freeze dev builds. Release builds never run that logging; this keeps dev the same.
 */
if (__DEV__) {
  const proto = BigInt.prototype as unknown as { toJSON?: () => string };
  if (typeof proto.toJSON !== "function") proto.toJSON = function toJSON(this: bigint) { return this.toString(); };
}
