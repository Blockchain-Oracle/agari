"use client";

import type { BlockerKind } from "@agari/core/copy";
import { formatBaseUnits, parseDecimalToBaseUnits } from "@agari/core/units";
import { useState } from "react";
import { blockerLabel } from "@/lib/copy";
import { AmountField } from "./AmountField";
import { VAULT } from "./copy";
import type { VaultWriteKind } from "./useVaultWrite";

export interface VaultControlsProps {
  decimals: number;
  symbol?: string;
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
export function VaultControls({ decimals, symbol = "tUSDC", availableBase, privateAvailableBase, walletSpendableBase, needsApproval, blocker, busy, onDeposit, onWithdraw, onWithdrawPrivate }: VaultControlsProps) {
  const [typed, setTyped] = useState<string | null>(null);
  // Untouched, the default never asks for more than the wallet holds: a wallet with less starts at what it has.
  const amount = typed ?? (walletSpendableBase !== null && walletSpendableBase > 0n && (parseDecimalToBaseUnits(DEFAULT_AMOUNT, decimals) ?? 0n) > walletSpendableBase ? formatBaseUnits(walletSpendableBase, decimals, { minDp: 0 }).replace(/,/g, "") : DEFAULT_AMOUNT);
  const setAmount = setTyped;
  const amountBase = parseDecimalToBaseUnits(amount, decimals) ?? 0n;
  const blocked = blocker !== null || busy !== null;
  const depositDisabled = blocked || amountBase <= 0n || walletSpendableBase === null || walletSpendableBase < amountBase;
  const withdrawDisabled = blocked || availableBase <= 0n;

  return (
    <div className="flex flex-col gap-2">
      <div className="vault-controls">
        <AmountField value={amount} onChange={setAmount} decimals={decimals} symbol={symbol} maxBase={walletSpendableBase} label={VAULT.amountLabel} />
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
