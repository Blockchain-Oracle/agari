/**
 * Private mode on Solana is `agari-private` (S10d): a budget only its owner can withdraw, a throwaway slot per bet,
 * and a pool between them that neither half names. The owner's writes go through the wallet's lane; the desk's
 * three-transaction open and the way home are the server-side desk service's.
 */
export { verifyPrivateClaim } from "./claim";
export { privateProgramId } from "./deployment";
export { cashOutPrivateBet, ClaimRefusedError } from "./desk-cashout";
export { createDeskClient, type DeskClient, type DeskClientConfig } from "./desk-client";
export { publicReason } from "./desk-errors";
export { deskHealth } from "./desk-health";
export { openPrivateBet, type DeskOpenInput } from "./desk-open";
export { getPrivateBudget, getPrivateDeskState, getPrivateSlot, sizePrivateForStake, toPrivateBudget } from "./reads";
export { submitPrivateTx } from "./writes";
