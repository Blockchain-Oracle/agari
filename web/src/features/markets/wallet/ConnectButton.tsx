"use client";

import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import { Hash } from "@/components/data";
import { Button } from "@/components/ui/button";
import { BANNER, CONNECT } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";

/** The connect ladder: disconnected → connecting → wrong chain (one tap fixes it) → ready. */
export function ConnectButton() {
  const { isConnecting, isRightChain, switching, switchToShannon } = useWalletSession();

  return (
    <RainbowConnectButton.Custom>
      {({ account, chain, mounted, openConnectModal, openAccountModal }) => {
        // Before hydration the server and client must agree, so the control is present but inert.
        if (!mounted) {
          return (
            <Button variant="secondary" className="invisible" aria-hidden="true" tabIndex={-1}>
              {CONNECT.connect}
            </Button>
          );
        }
        if (!account || !chain) {
          return (
            <Button onClick={openConnectModal} disabled={isConnecting}>
              {isConnecting ? CONNECT.connecting : CONNECT.connect}
            </Button>
          );
        }
        if (!isRightChain) {
          return (
            <Button variant="outline" className="text-warning" onClick={switchToShannon} disabled={switching}>
              {switching ? BANNER.switching : CONNECT.wrongChain}
            </Button>
          );
        }
        return (
          <Button variant="secondary" onClick={openAccountModal}>
            <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
            <Hash value={account.address} />
          </Button>
        );
      }}
    </RainbowConnectButton.Custom>
  );
}
