import { FEE_RESERVE_LAMPORTS, LAMPORTS_PER_SIGNATURE } from "@agari/core/constants";

/**
 * What a seat's key needs to pay its own picks, and what a sponsor may send it — pure, so the entry, the sponsor route
 * and the pick screen all size the same envelope. Amounts are SOL in lamports.
 *
 * Masayume's envelope was a Somnia gas floor plus per-pick burn at the SDK's max fee. On Solana a pick is one
 * transaction the key signs and pays for: the base fee per signature, once per card and once more for a retry (both
 * seats draw on the same book, so a lost race is normal), on top of the fee reserve the submitter's check demands
 * before any send. The rent-exempt minimum a fresh key account must hold to exist, and any priority fee, are the arena
 * program's to size when it lands (S12).
 *
 * It is what an entry sends the key when the player pays, and what the sponsor tops the key up to when it does; the two
 * never overlap, because a sponsored entry carries no value at all.
 */
export const PICK_ATTEMPTS_FUNDED = 2;

/** The widest deck the policy deals, so a cap sized off it covers any match. */
const WIDEST_DECK = 5;

/** The fee one pick attempt costs: one signature, the key's. */
export function pickFeeLamports(): bigint {
  return LAMPORTS_PER_SIGNATURE;
}

/** The reserve the fee check demands before any send, plus every card's pick and its retry. */
export function deckFeeLamports(deckSize: number): bigint {
  return FEE_RESERVE_LAMPORTS + pickFeeLamports() * BigInt(deckSize * PICK_ATTEMPTS_FUNDED);
}

/** The most a sponsor sends one key for one match unless the operator says otherwise: one full deck's envelope. */
export function sponsorDefaultCapLamports(): bigint {
  return deckFeeLamports(WIDEST_DECK);
}

/**
 * What a sponsor sends a key: the deck's envelope less what the key already holds, never above the cap, never negative.
 * A key that already holds its envelope is sent nothing, so a re-ask is free of cost as well as of prompts.
 */
export function sponsorTopUpLamports(deckSize: number, heldLamports: bigint, capLamports: bigint): bigint {
  const need = deckFeeLamports(deckSize) - heldLamports;
  if (need <= 0n) return 0n;
  return need > capLamports ? capLamports : need;
}
