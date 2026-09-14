/**
 * The devnet SOL faucet's server side: a dedicated funding keypair that tops a wallet up for fees (core
 * `SOL_FAUCET_POLICY`). The signed transfer, its `lastValidBlockHeight` reconcile and the broadcast need the RPC
 * client (S4). Until then only the funder's address is known and every chain step refuses. Browser code never
 * imports this module.
 */
import { FaucetError, SOL_FAUCET_POLICY, type FaucetClaim } from "@agari/core/faucet";
import type { Address } from "@agari/core/types";
import { keypairAddress } from "../sessions/keypair";
import { RPC_HTTP_URLS } from "../chain";

function unavailable(): never {
  throw new FaucetError("not-deployed", "The devnet SOL faucet is not available yet on this deployment.", 503);
}

export function createFaucetChain(secretKey: Uint8Array, _rpcUrl: string = RPC_HTTP_URLS[0] as string) {
  const address: Address = keypairAddress(secretKey);
  return {
    address,
    cluster: SOL_FAUCET_POLICY.cluster,
    balance: async (_wallet: string): Promise<bigint> => unavailable(),
    /** ed25519 over the challenge text (core `verifySignedMessage`). */
    verify: async (_wallet: string, _message: string, _signature: string): Promise<boolean> => unavailable(),
    prepare: async (_wallet: string, _amountLamports: bigint): Promise<{ lastValidBlockHeight: number; feeLamports: string; rawTransaction: string; txHash: string }> => unavailable(),
    inspect: async (_claim: FaucetClaim): Promise<FaucetClaim["status"]> => unavailable(),
    broadcast: async (_claim: FaucetClaim): Promise<void> => unavailable(),
  };
}

export type FaucetChain = ReturnType<typeof createFaucetChain>;
