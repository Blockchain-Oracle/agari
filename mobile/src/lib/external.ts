import * as WebBrowser from "expo-web-browser";
import { SITE_URL } from "./env";

/**
 * The app's one door to the outside: guides on the docs site, a transaction on an explorer, a wallet's store page.
 * Agari's own product pages are native screens, so a link back to the web app is refused here rather than opened
 * (the `mobile-no-web-handoff` invariant keeps every other file off the browser).
 */
const PRODUCT_ORIGIN = new URL(SITE_URL).host;

export function isProductUrl(url: string): boolean {
  try {
    const host = new URL(url).host;
    return host === PRODUCT_ORIGIN || host === "useagari.xyz" || host === "www.useagari.xyz";
  } catch {
    return false;
  }
}

export async function openExternal(url: string): Promise<void> {
  if (isProductUrl(url)) throw new Error(`Refusing to open an Agari product page in a browser: ${url}`);
  await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
}

/** A devnet transaction or account on Solana Explorer. */
export function explorerUrl(kind: "tx" | "address", id: string): string {
  return `https://explorer.solana.com/${kind}/${id}?cluster=devnet`;
}
