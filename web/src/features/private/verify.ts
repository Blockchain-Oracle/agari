import type { PrivateTicket } from "@masayume/core/private";
import type { Address } from "@masayume/core/types";
import { claimDomain, verifyPrivateClaim } from "@masayume/markets/private";

/**
 * Runs locally, against the key the CONTRACT pins when that is known, so trusting a claim never requires
 * trusting the desk to answer honestly. A ticket from another deployment or chain is simply not a claim here.
 */
export async function verifyTicket(ticket: PrivateTicket, pinnedDesk: Address | null, contract: Address | null, chainId: number): Promise<boolean> {
  if (ticket.chainId !== chainId) return false;
  if (contract && ticket.contract.toLowerCase() !== contract.toLowerCase()) return false;
  const signer = pinnedDesk ?? ticket.desk;
  return verifyPrivateClaim(claimDomain(ticket.chainId, ticket.contract), ticket.claim, ticket.signature, signer);
}
