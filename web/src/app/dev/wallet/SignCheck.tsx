"use client";

import { CLUSTER_LABEL, type Cluster } from "@agari/core/constants";
import { SIGNED_MESSAGE_BRAND, networkLine } from "@agari/core/auth";
import type { Address } from "@agari/core/types";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WALLET_DEV } from "@/lib/copy";
import { webEnv } from "@/lib/env";
import { signText, useOwnerWallet } from "@/lib/wallet-session";

type Check =
  | { phase: "idle" }
  | { phase: "signing" }
  | { phase: "done"; valid: boolean; tamperedValid: boolean }
  | { phase: "error"; why: string };

/** The text the check signs: readable, bound to this wallet, cluster and moment, and worthless as a permission. */
export function devCheckText(address: Address, cluster: Cluster, issuedAtMs: number): string {
  return [
    `${SIGNED_MESSAGE_BRAND} wallet check`,
    `Wallet: ${address}`,
    networkLine(cluster),
    `Issued: ${new Date(issuedAtMs).toISOString()}`,
    "This proves the server can verify your signature. It is not a transaction and grants nothing.",
  ].join("\n");
}

/** Wallet connect → the wallet signs → the server verifies with ed25519 (and refuses a tampered copy). */
export function SignCheck() {
  const wallet = useOwnerWallet();
  const [check, setCheck] = useState<Check>({ phase: "idle" });

  async function run() {
    if (!wallet) return;
    setCheck({ phase: "signing" });
    try {
      const text = devCheckText(wallet.address, webEnv.markets.cluster, Date.now());
      const signature = await signText(wallet, text);
      const response = await fetch("/api/dev/verify-message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, signature, signer: wallet.address }),
      });
      const body = (await response.json()) as { valid?: boolean; tamperedValid?: boolean; error?: string };
      if (!response.ok || body.valid === undefined || body.tamperedValid === undefined) throw new Error(body.error ?? `HTTP ${response.status}`);
      setCheck({ phase: "done", valid: body.valid, tamperedValid: body.tamperedValid });
    } catch (error) {
      setCheck({ phase: "error", why: error instanceof Error ? error.message : String(error) });
    }
  }

  if (!wallet) return <p className="type-caption text-ink-secondary">{WALLET_DEV.signCheck.connectFirst}</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="type-caption text-ink-secondary">{WALLET_DEV.signCheck.intro(CLUSTER_LABEL[webEnv.markets.cluster])}</p>
      <div>
        <Button onClick={run} disabled={check.phase === "signing"}>
          {check.phase === "signing" ? WALLET_DEV.signCheck.signing : WALLET_DEV.signCheck.run}
        </Button>
      </div>
      {check.phase === "done" && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 type-caption text-ink-secondary">
          <dt>{WALLET_DEV.signCheck.exact}</dt>
          <dd className="text-ink">{check.valid ? WALLET_DEV.signCheck.verified : WALLET_DEV.signCheck.rejected}</dd>
          <dt>{WALLET_DEV.signCheck.tampered}</dt>
          <dd className="text-ink">{check.tamperedValid ? WALLET_DEV.signCheck.brokenVerifier : WALLET_DEV.signCheck.rejectedAsExpected}</dd>
        </dl>
      )}
      {check.phase === "error" && <p className="type-caption text-ink-secondary">{WALLET_DEV.signCheck.failed(check.why)}</p>}
    </div>
  );
}
