"use client";

import { useConnect, useIsWalletReady, useWallets } from "@solana/kit-plugin-wallet/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { WALLET_PICKER } from "@/lib/copy";
import { walletClient } from "./kit-wallet";

type DiscoveredWallet = ReturnType<typeof useWallets>[number];

/**
 * The wallet list (D-023): every Wallet Standard wallet installed in this browser that supports the app's chain, as
 * Masayume's connect modal listed wallets. No wallet found is said plainly, with where to get one.
 */
export function WalletPicker({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const wallets = useWallets(walletClient);
  const ready = useIsWalletReady(walletClient);
  const { dispatchAsync: connect, isRunning } = useConnect(walletClient);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function choose(wallet: DiscoveredWallet) {
    setFailure(null);
    setChoosing(wallet.name);
    try {
      await connect(wallet);
      onOpenChange(false);
    } catch (error) {
      if ((error as Error).name !== "AbortError") setFailure(WALLET_PICKER.failed(wallet.name, (error as Error).message));
    } finally {
      setChoosing(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) setFailure(null); onOpenChange(next); }}>
      {/* Above the app strip (900), ticker (850), header (800), Sensei drawer (950) and mobile nav overlay (980). */}
      <SheetContent side="right" className="z-[1000] flex flex-col gap-4 p-5" overlayClassName="z-[1000]">
        <SheetHeader className="p-0">
          <SheetTitle>{WALLET_PICKER.title}</SheetTitle>
          <SheetDescription>{WALLET_PICKER.description}</SheetDescription>
        </SheetHeader>

        {!ready && <p className="type-body text-ink-secondary">{WALLET_PICKER.detecting}</p>}

        {ready && wallets.length > 0 && (
          <ul className="flex flex-col gap-2">
            {wallets.map((wallet) => (
              <li key={wallet.name}>
                <Button variant="secondary" className="w-full justify-start gap-3" disabled={isRunning} onClick={() => void choose(wallet)}>
                  {/* Wallet Standard icons are data: URIs the wallet itself provides. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={wallet.icon} alt="" width={20} height={20} className="size-5 rounded" />
                  <span>{choosing === wallet.name ? WALLET_PICKER.connecting(wallet.name) : wallet.name}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}

        {ready && wallets.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="type-body-strong text-ink">{WALLET_PICKER.none}</p>
            <p className="type-body text-ink-secondary">{WALLET_PICKER.noneHint}</p>
            <ul className="flex flex-col gap-1 type-body">
              {WALLET_PICKER.installs.map((install) => (
                <li key={install.name}>
                  <a className="text-accent underline-offset-4 hover:underline" href={install.href} target="_blank" rel="noreferrer">
                    {install.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {failure && <p role="alert" className="type-body text-ink-secondary">{failure}</p>}
        <p className="type-caption text-ink-muted">{WALLET_PICKER.devnet}</p>
      </SheetContent>
    </Sheet>
  );
}
