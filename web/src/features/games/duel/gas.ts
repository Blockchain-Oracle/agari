import { SDK_MAX_FEE_PER_GAS_WEI } from "@masayume/core/constants";
import { requiredGasWei } from "@masayume/markets";

/**
 * What a seat's key needs in its tank, and what a sponsor may put there — pure, so the entry, the
 * sponsor route and the pick screen all size the same envelope.
 *
 * Two different numbers are in it, and conflating them was slice 8a's mistake. The gas gate refuses a
 * send unless the sender HOLDS the lane's whole ceiling at the SDK's max fee (Somnia rejects a
 * transaction whose sender cannot cover `gasLimit × maxFeePerGas`, whatever it will actually burn); that
 * is a floor the key must sit on, not a cost, and it is paid once. What a pick actually BURNS is a few
 * hundred thousand gas — 276k measured on the fork duel — so the spend is that, at the max fee, once per
 * card and once more for a retry, because both seats draw on the same book and a lost race is normal.
 * Funding the ceiling per card sent a five-card key 5.76 STT with no way back; the floor plus the spend
 * is under one.
 *
 * It is what an entry sends the key when the player pays, and what the sponsor tops the key up to when
 * it does; the two never overlap, because a sponsored entry carries no value at all.
 */
export const PICK_ATTEMPTS_FUNDED = 2;
/** What one pick burns, with room over the 276k measured on the fork duel (context/56 §3). */
export const PICK_GAS_USED = 320_000n;

/** The widest deck the policy deals, so a cap sized off it covers any match. */
const WIDEST_DECK = 5;

/** The fee one attempt can cost at the fee the gate assumes. */
export function pickFeeWei(): bigint {
  return PICK_GAS_USED * SDK_MAX_FEE_PER_GAS_WEI;
}

/** The floor the gate demands before any send, plus the spend of every card and its retry. */
export function deckGasWei(deckSize: number): bigint {
  return requiredGasWei("arena") + pickFeeWei() * BigInt(deckSize * PICK_ATTEMPTS_FUNDED);
}

/** The most a sponsor sends one key for one match unless the operator says otherwise: one full deck's envelope. */
export function sponsorDefaultCapWei(): bigint {
  return deckGasWei(WIDEST_DECK);
}

/**
 * What a sponsor sends a key: the deck's envelope less what the key already holds, never above the cap,
 * never negative. A key that already holds its envelope is sent nothing, so a re-ask is free of cost as
 * well as of prompts.
 */
export function sponsorTopUpWei(deckSize: number, heldWei: bigint, capWei: bigint): bigint {
  const need = deckGasWei(deckSize) - heldWei;
  if (need <= 0n) return 0n;
  return need > capWei ? capWei : need;
}
