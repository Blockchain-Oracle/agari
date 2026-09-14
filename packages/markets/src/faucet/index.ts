/**
 * The devnet faucet's server side (D-012, D-034): a dedicated `sol-faucet` keypair that tops a wallet up for fees
 * (core `SOL_FAUCET_POLICY`) and pays for server-sent tUSDC mints signed by `faucet-mint-authority`
 * (`TUSDC_FAUCET_POLICY`). Browser code never imports this module.
 */
import { RPC_HTTP_URLS } from "../chain";
import { createSolanaFaucetChain, type FaucetKeys } from "./solana";

/** `rpcUrl` defaults to public devnet (`SOL_FAUCET_RPC_URL` unset), keeping the ops RPC budget whole (D-030). */
export function createFaucetChain(keys: FaucetKeys, rpcUrl?: string) {
  return createSolanaFaucetChain(keys, rpcUrl || (RPC_HTTP_URLS[0] as string));
}

export type FaucetChain = ReturnType<typeof createFaucetChain>;
export type { FaucetKeys, FaucetMint, PreparedFaucetTransaction } from "./solana";
export { FAUCET_ROLE_ENV, faucetRoleSecret, type FaucetRole } from "./keys";
