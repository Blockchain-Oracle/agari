"use client";

import { Hash } from "@/components/data";
import { Button } from "@/components/ui/button";
import { CONNECT } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";

/**
 * The connect ladder: disconnected (opens the connect modal: every Wallet Standard wallet in this browser, D-023) →
 * connecting → connected. There is no wrong-chain rung on Solana; the cluster is the app's, not the wallet's.
 */
export function ConnectButton() {
  const session = useWalletSession();

  // Masayume's rung: "Connecting…" while a remembered wallet restores or a connection is in flight, "Connect" otherwise.
  // The server render and hydration are always "Connect" (the wallet shell is not restoring there).
  if (!session.isConnected || !session.address) {
    const busy = session.isConnecting || session.connecting;
    return (
      <Button onClick={session.connect} disabled={busy}>
        {busy ? CONNECT.connecting : CONNECT.connect}
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
