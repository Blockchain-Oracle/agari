import type { LinkPort } from "@agari/markets/sessions/mobile";
import * as Linking from "expo-linking";
import { AppState, Platform } from "react-native";

const RETURN_PREFIX = "agari://wallet/";
/** How long after the app comes back to wait for the wallet's reply link before calling the hand-off cancelled. */
const RETURN_GRACE_MS = 1_500;
const RETURN_TIMEOUT_MS = 45_000;

type Pending = { method: string; resolve: (params: URLSearchParams) => void; reject: (error: Error) => void };
let pending: Pending | null = null;

/**
 * Called from +native-intent for every incoming link: a wallet's reply completes the hand-off waiting for it and is
 * swallowed (true), anything else routes as usual (false).
 */
export function deliverWalletReturn(path: string): boolean {
  // The link arrives whole (agari://wallet/connect?…) or as a path (/wallet/connect?…).
  const rest = path.replace(/^agari:\/\//, "").replace(/^\/+/, "");
  if (!rest.startsWith("wallet/")) return false;
  const url = new URL(`${RETURN_PREFIX}${rest.slice("wallet/".length)}`);
  const method = url.pathname.replace(/^\/+/, "");
  if (pending?.method === method) {
    const { resolve } = pending;
    pending = null;
    resolve(url.searchParams);
  }
  return true;
}

export const linkPort: LinkPort = {
  redirectFor: (method) => `${RETURN_PREFIX}${method}`,
  roundTrip(url, method) {
    pending?.reject(new Error("Replaced by a newer wallet request."));
    return new Promise<URLSearchParams>((resolve, reject) => {
      let left = false;
      let settled = false;
      const finish = (error?: Error, params?: URLSearchParams) => {
        if (settled) return;
        settled = true;
        if (pending?.method === method) pending = null;
        sub.remove();
        linkSub.remove();
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve(params!);
      };
      const sub = AppState.addEventListener("change", (state) => {
        if (state !== "active") {
          left = true;
          return;
        }
        if (!left) return;
        setTimeout(() => {
          if (pending?.method !== method) return;
          finish(new Error("The wallet did not return to Agari. Check the wallet app or try again."));
        }, RETURN_GRACE_MS);
      });
      const linkSub = Linking.addEventListener("url", (event) => { deliverWalletReturn(event.url); });
      const timeout = setTimeout(() => finish(new Error("The wallet did not return to Agari. Check that it is installed and try again.")), RETURN_TIMEOUT_MS);
      pending = {
        method,
        resolve: (params) => finish(undefined, params),
        reject: (error) => finish(error),
      };
      Linking.openURL(url).catch((error: unknown) => finish(error instanceof Error ? error : new Error(String(error))));
    });
  },
};

/** Whether the wallet app is on this phone (its scheme is declared in LSApplicationQueriesSchemes). */
export const isWalletInstalled = (scheme: "phantom" | "solflare") => Platform.OS === "android" ? Promise.resolve(true) : Linking.canOpenURL(`${scheme}://`);
