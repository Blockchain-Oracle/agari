"use client";

import { isOk } from "@masayume/core/schemas";
import { formatBaseUnits, parseDecimalToBaseUnits, shortHex } from "@masayume/core/units";
import { useBalanceSheet, usePrivateBudget, usePrivateDesk } from "@masayume/markets/react";
import { useState } from "react";
import { Money } from "@/components/data";
import { ErrorState, LoadingState } from "@/components/states";
import { blockerLabel } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { useWalletSession } from "@/lib/wallet-session";
import { useVenue } from "../markets/useVenue";
import { deriveVaultBlocker } from "../vault/vault-blocker";
import "../vault/vault.css";
import { usePrivateTickets } from "./claims-store";
import { PRIVATE } from "./copy";
import { PrivateClaims } from "./PrivateClaims";
import { usePrivateCashout } from "./usePrivateCashout";
import { usePrivateWrites } from "./usePrivateWrites";

const DEFAULT_AMOUNT = "5";

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="vault-cell-label">{label}</span>
      <div className="vault-cell-value">{children}</div>
    </div>
  );
}

/**
 * The private balance behind the plate's Private row — the Trading Balance block's grammar (eyebrow, one
 * sentence, controls, cells) over the desk's own numbers, then the claims list. Deposit allows the desk
 * the whole new balance (the reference's one-transaction fund-and-allocate); Withdraw takes it all back;
 * Revoke stops private bets and leaves the money where it is.
 */
export function PrivateBalancePanel({ inline, className }: { inline?: boolean; className?: string }) {
  const session = useWalletSession();
  const { address } = session;
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  const deskReading = usePrivateDesk();
  const budgetReading = usePrivateBudget(address);
  const sheet = useBalanceSheet(address);
  const writes = usePrivateWrites();
  const { tickets, refresh } = usePrivateTickets(address);
  const desk = deskReading && isOk(deskReading) ? deskReading.value : null;
  const decimals = desk?.decimals ?? 6;
  const cashout = usePrivateCashout(refresh, decimals, symbol);
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const frame = cn("vault-panel", inline && "vault-panel-inline", className);

  if (!address) return null;
  if (deskReading === null) return <LoadingState shape="row" className={frame} />;
  if (!isOk(deskReading)) return <ErrorState diagnosis={deskReading.error} className={frame} />;
  if (!desk) {
    return (
      <div className={frame}>
        <p className="type-body text-ink">{PRIVATE.notDeployed.why}</p>
        <p className="mt-1 type-caption text-ink-muted">{PRIVATE.notDeployed.how}</p>
      </div>
    );
  }

  const budget = budgetReading && isOk(budgetReading) ? budgetReading.value : null;
  const walletSpendable = sheet && isOk(sheet) ? sheet.value.spendableBase : null;
  const amountBase = parseDecimalToBaseUnits(amount, decimals) ?? 0n;
  const blocker = deriveVaultBlocker({ session, hasSigner: writes.hasSigner, busy: writes.state.busy !== null, gasShort: writes.state.gasShort });
  const blocked = blocker !== null;
  const busy = writes.state.busy;
  const depositDisabled = blocked || amountBase <= 0n || walletSpendable === null || walletSpendable < amountBase || budget === null;
  const withdrawDisabled = blocked || !budget || budget.balanceBase <= 0n;
  const revokeDisabled = blocked || !budget || budget.allowanceBase <= 0n;

  return (
    <div className={frame}>
      <div className="vault-head">
        <div>
          <span className="vault-eyebrow">{PRIVATE.panel.eyebrow}</span>
          <p className="vault-note">{PRIVATE.panel.note}</p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="vault-controls">
            <input type="number" min="0" step="0.1" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="vault-input" aria-label={PRIVATE.panel.amountLabel} />
            <div className="vault-buttons">
              <button
                type="button"
                onClick={() => budget && void writes.run({ kind: "private-deposit-and-allow", amountBase, allowanceBase: budget.balanceBase + amountBase }, PRIVATE.toasts.deposited)}
                disabled={depositDisabled}
                className="vault-btn vault-btn-primary"
                data-cursor="hover"
              >
                {busy === "private-deposit-and-allow" ? PRIVATE.panel.depositing : PRIVATE.panel.deposit}
              </button>
              <button type="button" onClick={() => budget && void writes.run({ kind: "private-withdraw", amountBase: budget.balanceBase }, PRIVATE.toasts.withdrawn)} disabled={withdrawDisabled} className="vault-btn vault-btn-outline" data-cursor="hover">
                {busy === "private-withdraw" ? PRIVATE.panel.withdrawing : PRIVATE.panel.withdraw}
              </button>
              <button type="button" onClick={() => void writes.run({ kind: "private-revoke" }, PRIVATE.toasts.revoked)} disabled={revokeDisabled} className="vault-btn vault-btn-private" data-cursor="hover">
                {busy === "private-revoke" ? PRIVATE.panel.revoking : PRIVATE.panel.revoke}
              </button>
            </div>
          </div>
          {blocker ? <span className="type-caption text-ink-secondary">{blockerLabel(blocker)}</span> : <span className="type-caption text-ink-secondary">{PRIVATE.panel.allowanceNote}</span>}
        </div>
      </div>

      <div className="vault-cells">
        <Cell label={PRIVATE.panel.cells.balance}>{budget ? <Money value={budget.balanceBase} decimals={decimals} /> : "—"}</Cell>
        <Cell label={PRIVATE.panel.cells.allowance}>{budget ? <Money value={budget.allowanceBase} decimals={decimals} /> : "—"}</Cell>
        <Cell label={PRIVATE.panel.cells.spendable}>{budget ? <Money value={budget.spendableBase} decimals={decimals} className={cn(budget.spendableBase > 0n && "vault-cell-value-live")} /> : "—"}</Cell>
        <Cell label={PRIVATE.panel.cells.desk}>{shortHex(desk.desk)}</Cell>
        <Cell label={PRIVATE.panel.cells.cap}>{`${formatBaseUnits(desk.params.maxStakeBase, decimals, { minDp: 0 })} ${symbol}`}</Cell>
      </div>
      <p className="vault-loading">{PRIVATE.panel.trust}</p>
      <p className="vault-loading">{PRIVATE.panel.correlation}</p>

      <div className="vault-grants">
        <PrivateClaims claims={tickets} pinnedDesk={desk.desk} contract={desk.deployment.privateDesk} chainId={desk.deployment.chainId} owner={address} decimals={decimals} symbol={symbol} onCashOut={(t) => void cashout.cashOut(t)} busySlot={cashout.busySlot} onChanged={refresh} />
      </div>
    </div>
  );
}
