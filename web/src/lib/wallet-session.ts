"use client";

import type { Address } from "@masayume/core/types";
import { SOMNIA_SHANNON } from "@masayume/markets/chain";
import { useCallback } from "react";
import { useAccount, useSwitchChain } from "wagmi";

export interface WalletSession {
  address: Address | null;
  /** The chain the wallet is actually on — may be one we don't configure. */
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  isRightChain: boolean;
  switching: boolean;
  /** Adds Somnia Shannon to the wallet when missing, then switches — at most two prompts (FR-1). */
  switchToShannon: () => void;
}

/** The sole wagmi surface in product code: wallet session only, never chain reads (AD-14). */
export function useWalletSession(): WalletSession {
  const { address, chainId, isConnected, isConnecting, isReconnecting } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const switchToShannon = useCallback(() => switchChain({ chainId: SOMNIA_SHANNON.id }), [switchChain]);

  return {
    address: address ?? null,
    chainId: chainId ?? null,
    isConnected,
    isConnecting: isConnecting || isReconnecting,
    isRightChain: isConnected && chainId === SOMNIA_SHANNON.id,
    switching: isPending,
    switchToShannon,
  };
}
