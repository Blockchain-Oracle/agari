import { CREDITED_EVENT } from "./copy";

export interface CreditedDetail {
  amountText: string;
  symbol: string;
  firstTime: boolean;
}

const WELCOMED_KEY = (address: string) => `masayume.welcomed.${address.toLowerCase()}`;

/**
 * Announces a credit. The FIRST for an address is the celebratory moment (`CreditWelcome`); the rest are
 * routine — the reference's `Header.tsx` L190–200, with the same per-address localStorage guard, so a
 * wallet is welcomed once and never again.
 */
export function announceCredit(address: string, amountText: string, symbol: string): void {
  let firstTime = false;
  try {
    firstTime = !localStorage.getItem(WELCOMED_KEY(address));
    if (firstTime) localStorage.setItem(WELCOMED_KEY(address), "1");
  } catch {
    // storage refused — a toast still says it happened
  }
  window.dispatchEvent(new CustomEvent<CreditedDetail>(CREDITED_EVENT, { detail: { amountText, symbol, firstTime } }));
}

export function openFunds(): void {
  window.dispatchEvent(new Event("masayume:open-funds"));
}
