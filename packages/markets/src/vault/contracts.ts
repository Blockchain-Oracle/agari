import type { Address, Signature } from "@agari/core/types";
import type { VaultDeployment } from "@agari/core/vault";

/**
 * The signing context a product write needs: who signs, and the deployment it targets. Masayume's version carried
 * viem clients; on Solana the transaction is built by `packages/markets` from the session itself (S4, S7).
 */
export interface VaultContracts {
  signer: Address;
  deployment: VaultDeployment | null;
}

/** What a product send hands back once it has landed. */
export interface Sent {
  txHash: Signature;
}
