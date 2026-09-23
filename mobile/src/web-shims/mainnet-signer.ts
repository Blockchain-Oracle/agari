import type { MainnetWalletSession } from "@/providers/wallet/mainnet-signer";
import { useMemo } from "react";
import { useWalletShell } from "@/providers/wallet/wallet-shell-context";
import { SITE_URL } from "~/lib/env";

/**
 * Stands in for web/src/providers/wallet/mainnet-signer.ts. Web re-wraps a Wallet Standard account for
 * `solana:mainnet`; the phone has no Wallet Standard registry, and every wallet it connects (the practice key, a
 * Phantom or Solflare link session, an Android MWA session) is opened on devnet. So a live desk's mainnet
 * transactions are refused with the reason, before any wallet is asked. Signed messages (a practice desk, approvals,
 * check now, sharing) never need this and keep working.
 */
export const MAINNET_CHAIN = "solana:mainnet";
/** Absolute on a phone: the Solana client builds its own requests and has no page origin to resolve a path against. */
export const MAINNET_RPC_PATH = `${SITE_URL}/api/rpc/mainnet`;

export type { MainnetWalletSession };

const WHY = "This phone's wallet session is connected on Solana devnet, so it cannot sign the desk's Solana mainnet transactions. Signed messages still work: practice, approvals, Check now and sharing.";

export function useMainnetWalletSession(): MainnetWalletSession {
  const shell = useWalletShell();
  const address = shell.status === "ready" ? shell.address : null;
  return useMemo<MainnetWalletSession>(() => {
    if (shell.status === "restoring") return { kind: "restoring" };
    if (address === null) return { kind: "no-wallet" };
    return { kind: "unsupported", address, why: WHY };
  }, [shell.status, address]);
}
