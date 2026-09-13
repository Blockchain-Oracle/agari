"use client";

import type { BlockerKind } from "@masayume/core/copy";
import { parseDecimalToBaseUnits } from "@masayume/core/units";
import { useState } from "react";
import { blockerLabel } from "@/lib/copy";
import { VAULT } from "./copy";
import type { VaultWriteKind } from "./useVaultWrite";

export interface VaultControlsProps {
  decimals: number;
  availableBase: bigint;
  privateAvailableBase: bigint;
  /** null until the wallet's sheet answers; a deposit cannot be sized against an unknown wallet. */
  walletSpendableBase: bigint | null;
  /** Whether the vault's allowance still has to be granted — the deposit then takes two signatures. */
  needsApproval: boolean;
  blocker: BlockerKind | null;
  busy: VaultWriteKind | null;
  onDeposit: (amountBase: bigint) => void;
  onWithdraw: () => void;
  onWithdrawPrivate: () => void;
}

const DEFAULT_AMOUNT = "1";

/**
 * The reference's controls (L427–461): an amount for the deposit, Withdraw takes the whole
 * available balance, Withdraw Private appears only while a private balance exists. Disabled
 * exactly as the reference disables: while a write is in flight, on a zero amount, or when the
 * wallet cannot cover the deposit.
 */
export function VaultControls({ decimals, availableBase, privateAvailableBase, walletSpendableBase, needsApproval, blocker, busy, onDeposit, onWithdraw, onWithdrawPrivate }: VaultControlsProps) {
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const amountBase = parseDecimalToBaseUnits(amount, decimals) ?? 0n;
  const blocked = blocker !== null || busy !== null;
  const depositDisabled = blocked || amountBase <= 0n || walletSpendableBase === null || walletSpendableBase < amountBase;
  const withdrawDisabled = blocked || availableBase <= 0n;

  return (
    <div className="flex flex-col gap-2">
      <div className="vault-controls">
        <input
          type="number"
          min="0"
          step="0.1"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="vault-input"
          aria-label={VAULT.amountLabel}
        />
        <div className="vault-buttons">
          <button type="button" onClick={() => onDeposit(amountBase)} disabled={depositDisabled} className="vault-btn vault-btn-primary" data-cursor="hover">
            {busy === "vault-deposit" ? VAULT.depositing : VAULT.deposit}
          </button>
          <button type="button" onClick={onWithdraw} disabled={withdrawDisabled} className="vault-btn vault-btn-outline" data-cursor="hover">
            {busy === "vault-withdraw" ? VAULT.withdrawing : VAULT.withdraw}
          </button>
          {privateAvailableBase > 0n && (
            <button type="button" onClick={onWithdrawPrivate} disabled={blocked} className="vault-btn vault-btn-private" data-cursor="hover">
              {busy === "vault-withdraw-private" ? VAULT.withdrawing : VAULT.withdrawPrivate}
            </button>
          )}
        </div>
      </div>
      {blocker && <span className="type-caption text-ink-secondary">{blockerLabel(blocker)}</span>}
      {!blocker && needsApproval && <span className="type-caption text-ink-secondary">{VAULT.approvalNote}</span>}
    </div>
  );
}
