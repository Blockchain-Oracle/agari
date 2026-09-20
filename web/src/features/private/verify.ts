import type { PrivateTicket } from "@agari/core/private";
import type { Address } from "@agari/core/types";
import { verifyPrivateClaim } from "@agari/markets/private";

/**
 * Runs locally, against the key the on-chain Desk account pins, so trusting a claim never requires trusting the desk
 * to answer honestly. The claim is an ed25519 signature by the desk key over `privateClaimMessage` (PD-4), which names
 * the desk account and its cluster: a ticket for another deployment, a ticket whose fields were edited, and a ticket
 * signed by a key the chain does not pin all fail here. Without a pinned key to check against, nothing verifies.
 */
export async function verifyTicket(ticket: PrivateTicket, pinnedDesk: Address | null, contract: Address | null, chainId: number): Promise<boolean> {
  if (ticket.chainId !== chainId) return false;
  // Base58 is case-sensitive: the desk account is compared exactly (D-010).
  if (!contract || ticket.contract !== contract) return false;
  if (!pinnedDesk || ticket.desk !== pinnedDesk) return false;
  return verifyPrivateClaim(ticket.claim, ticket.signature, pinnedDesk, contract, chainId);
}
