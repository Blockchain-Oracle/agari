import type { SomniaMarkets } from "@somnia-chain/markets-sdk";

/**
 * The raw write tier bound to exactly one signer.
 *
 * Taken off the SDK's own type so the write lanes never import the exchange itself — a lane
 * that can reach an exchange can reach `setSigner`, and the whole point of a session is that
 * its signer cannot be swapped underneath it.
 */
export type SessionTrader = SomniaMarkets["trader"];
