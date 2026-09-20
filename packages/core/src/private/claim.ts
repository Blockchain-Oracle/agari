import { SIGNED_MESSAGE_BRAND } from "../auth/signed-message";
import { clusterLabelOfId } from "../constants/chain";
import type { PrivateClaim } from "./types";

/**
 * The exact text the desk key signs over a claim (PD-4): ed25519 over these UTF-8 bytes, like every other signed
 * text here (D-012). It names the desk account and its cluster, so a claim signed for one deployment never verifies
 * against another, and every field of the claim, so changing any of them breaks the signature. Append-only: a
 * reordered or reworded line invalidates every outstanding ticket.
 *
 * The owner's browser verifies it against the desk key the on-chain Desk account pins, never against the desk's word.
 */
export function privateClaimMessage(claim: PrivateClaim, contract: string, chainId: number): string {
  return [
    `${SIGNED_MESSAGE_BRAND} private claim`,
    `Desk: ${contract} on ${clusterLabelOfId(chainId)}`,
    `Owner: ${claim.owner}`,
    `Slot: ${claim.slotId}`,
    `Credit key: ${claim.creditKey}`,
    `Market: ${claim.marketId}`,
    `Outcome: ${claim.outcomeIdx}`,
    `Stake: ${claim.stakeBase}`,
    `Issued: ${claim.issuedAtMs}`,
  ].join("\n");
}
