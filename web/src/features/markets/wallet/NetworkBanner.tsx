"use client";

import { SOMNIA_SHANNON } from "@masayume/markets/chain";
import { WrongNetworkBanner } from "@/components/chrome";
import { useWalletSession } from "@/lib/wallet-session";

/** Shown only while a connected wallet sits on another chain; every write control beneath it is blocked-with-reason. */
export function NetworkBanner() {
  const { isConnected, isRightChain, switching, switchToShannon } = useWalletSession();
  if (!isConnected || isRightChain) return null;
  return <WrongNetworkBanner chainName={SOMNIA_SHANNON.name} onSwitch={switchToShannon} switching={switching} />;
}
