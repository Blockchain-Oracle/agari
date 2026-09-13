"use client";

import { useSigner } from "@masayume/markets/react";
import { SectionHeader } from "@/components/chrome";
import { Hash } from "@/components/data";
import { BalancePlate } from "@/features/markets/balance";
import { FaucetCard } from "@/features/markets/faucet";
import { ConnectButton } from "@/features/markets/wallet";
import { WALLET_DEV } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";

export default function DevWalletPage() {
  const session = useWalletSession();
  const { hasSigner } = useSigner();

  return (
    <div className="mx-auto flex w-full max-w-(--content-reading) flex-col gap-8 px-gutter py-8">
      <section className="flex flex-col gap-4">
        <SectionHeader index="01" title={WALLET_DEV.connection} aside={<ConnectButton />} />
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 type-caption text-ink-secondary">
          <dt>{WALLET_DEV.address}</dt>
          <dd className="text-ink">{session.address ? <Hash value={session.address} lead={10} tail={6} /> : "—"}</dd>
          <dt>{WALLET_DEV.chain}</dt>
          <dd className="text-ink">
            <span className="numbers">{session.chainId ?? "—"}</span>
            {session.isConnected && ` · ${session.isRightChain ? WALLET_DEV.rightChain : WALLET_DEV.wrongChain}`}
          </dd>
          <dt>{WALLET_DEV.signer}</dt>
          <dd className="text-ink">{hasSigner ? WALLET_DEV.signerBound : WALLET_DEV.noSigner}</dd>
        </dl>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader index="02" title={WALLET_DEV.balances} />
        <BalancePlate />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader index="03" title={WALLET_DEV.faucet} />
        <FaucetCard />
      </section>
    </div>
  );
}
