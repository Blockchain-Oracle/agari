import { SOMNIA_TESTNET_ADDRESSES, type SomniaMarketsAddresses } from "@somnia-chain/markets-sdk";
import pinned from "./addresses.pinned.json";

export const PINNED_TESTNET = pinned;

/** Throws if the SDK we installed ships different protocol addresses than the ones this app was verified against. */
export function assertAddressesMatchSdk(): void {
  const live = SOMNIA_TESTNET_ADDRESSES as Record<string, unknown>;
  for (const [key, expected] of Object.entries(pinned.addresses)) {
    const actual = live[key];
    if (typeof actual !== "string" || actual.toLowerCase() !== expected.toLowerCase()) {
      throw new Error(`address drift: ${key} pinned ${expected} but the SDK ships ${String(actual)}`);
    }
  }
}

/** Seam for the Foundry-generated addresses module (Epics 4/6/7 add our own contracts here). */
export function resolveAddresses(): SomniaMarketsAddresses {
  return SOMNIA_TESTNET_ADDRESSES;
}
