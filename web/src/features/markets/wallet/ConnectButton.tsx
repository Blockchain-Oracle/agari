"use client";

import { Hash } from "@/components/data";
import { Button } from "@/components/ui/button";
import { CONNECT } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";

/**
 * The connect ladder: restoring → disconnected (opens the wallet picker: every Wallet Standard wallet in this browser,
 * D-023) → connected. There is no wrong-chain rung on Solana; the cluster is the app's, not the wallet's.
 */
export function ConnectButton() {
  const session = useWalletSession();

  // Before hydration, and while a remembered session restores, the server and client must agree: present but inert.
  if (session.isConnecting) {
    return (
      <Button variant="secondary" className="invisible" aria-hidden="true" tabIndex={-1}>
        {CONNECT.connect}
      </Button>
    );
  }
  if (!session.isConnected || !session.address) {
    return (
      <Button onClick={session.connect} disabled={session.connecting}>
        {session.connecting ? CONNECT.connecting : CONNECT.connect}
      </Button>
    );
  }
  // Connected: Masayume's account button, which opens the account modal (avatar, address, copy, disconnect).
  return (
    <Button variant="secondary" onClick={session.openAccount} aria-label={CONNECT.connected}>
      <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
      <Hash value={session.address} lead={4} tail={4} />
    </Button>
  );
}
