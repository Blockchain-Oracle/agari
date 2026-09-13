"use client";

import { formatCadence } from "@masayume/core/copy";
import { isOk } from "@masayume/core/schemas";
import { formatBaseUnits } from "@masayume/core/units";
import { useVaultSnapshot, useWalletHistory } from "@masayume/markets/react";
import Link from "next/link";
import { CLAIM } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { useVenue } from "../markets/useVenue";
import { VAULT } from "./copy";
import { useVaultWrite } from "./useVaultWrite";
import "./vault.css";

const PORTFOLIO_PATH = "/portfolio";

/**
 * The Trading Balance's side of /claims. A Vault credit is a withdrawal, not a redeem (AD-1), so
 * nothing here joins the wallet's claim-all: settled Windows the vault still holds get their own
 * permissionless crank, and a balance already credited says where to withdraw it.
 */
export function VaultCreditRows({ className }: { className?: string }) {
  const { address } = useWalletSession();
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const snapshot = useVaultSnapshot(address);
  const history = useWalletHistory(address);
  const { state, run } = useVaultWrite();

  const vault = snapshot && isOk(snapshot) ? snapshot.value : null;
  if (!address || !vault) return null;
  const pending = history && isOk(history) ? history.value.rounds.filter((round) => round.source === "vault" && round.claim === "to-collect") : [];
  const credit = vault.account.availableBase;
  if (pending.length === 0 && credit === 0n) return null;

  return (
    <section className={className} aria-label={VAULT.claims.title}>
      <span className="vault-eyebrow">{VAULT.claims.title}</span>
      <ul className="mt-2 flex flex-col gap-2">
        {credit > 0n && (
          <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-md border border-hairline bg-surface-1 p-3">
            <span className="type-caption text-ink-secondary">
              <span className="text-ink">{CLAIM.kind["vault-credit"]}</span> · {VAULT.claims.credit(`${formatBaseUnits(credit, vault.decimals)} ${symbol}`.trim())}
            </span>
            <Link href={PORTFOLIO_PATH} data-cursor="hover" className="type-label-micro text-accent">
              {VAULT.claims.withdrawOn}
            </Link>
          </li>
        )}
        {pending.length > 0 && <li className="type-caption text-ink-muted">{VAULT.claims.waiting(pending.length)}</li>}
        {pending.map((round) => (
          <li key={round.marketId} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-md border border-hairline bg-surface-1 p-3">
            <span className="type-caption text-ink-secondary">
              <span className="text-ink">
                {round.asset} · {formatCadence(round.intervalSec)}
              </span>{" "}
              · {VAULT.rounds.via} · {VAULT.rounds.crankNote}
            </span>
            <button
              type="button"
              onClick={() => void run({ kind: "vault-crank-settle", owner: address, marketId: round.marketId }, VAULT.rounds.cranked)}
              disabled={state.busy !== null}
              className="vault-btn vault-btn-outline"
              data-cursor="hover"
            >
              {state.busy === "vault-crank-settle" ? VAULT.rounds.cranking : VAULT.rounds.crank}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
