import type { Address, Hex } from "@masayume/core/types";
import { createWalletClient, http, type PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SOMNIA_SHANNON } from "../chain";

export interface SponsorKeyTopUpInput {
  privateKey: Hex;
  rpcUrl: string;
  /** The seat's key, as the arena named it. The caller has checked that; this only sends. */
  key: Address;
  amountWei: bigint;
  publicClient: PublicClient;
}

/**
 * The sponsor's one write for the games (server-side only): STT to a seat's key, so the key pays for its
 * own picks. The arena's agent check is `msg.sender`, so the vault's forwarder cannot carry a pick; the
 * sponsor pays the duel's gas by putting it in the key's tank instead. Every policy question — is the key
 * the seat's, is the match live, how much, how often — is the route's; the chain write is here (AD-3).
 */
export async function sponsorKeyTopUp({ privateKey, rpcUrl, key, amountWei, publicClient }: SponsorKeyTopUpInput): Promise<Hex> {
  const account = privateKeyToAccount(privateKey);
  const sponsor = createWalletClient({ account, chain: SOMNIA_SHANNON, transport: http(rpcUrl) });
  const hash = await sponsor.sendTransaction({ account, chain: SOMNIA_SHANNON, to: key, value: amountWei });
  await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
  return hash;
}
