import type { PrivateTicket } from "@agari/core/private";
import type { Address } from "@agari/core/types";

/**
 * Runs locally, against the key the desk account pins when that is known, so trusting a claim never requires trusting
 * the desk to answer honestly. Masayume's claim was EIP-712 typed data; on Solana PD-4 needs an ed25519 claim over a
 * canonical encoding, which S10 defines with `agari-private`. Until then no ticket verifies (D-015): the claims list
 * shows nothing to trust rather than a claim this chain cannot check.
 */
export async function verifyTicket(ticket: PrivateTicket, _pinnedDesk: Address | null, contract: Address | null, chainId: number): Promise<boolean> {
  if (ticket.chainId !== chainId) return false;
  // Base58 is case-sensitive: the desk account is compared exactly (D-010).
  if (contract && ticket.contract !== contract) return false;
  return false;
}
