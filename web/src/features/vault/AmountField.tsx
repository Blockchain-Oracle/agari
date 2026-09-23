"use client";

import { formatBaseUnits, parseDecimalToBaseUnits } from "@agari/core/units";
import { cn } from "@/lib/utils";
import { VAULT } from "./copy";

/**
 * An amount with a Max and a reason (S23): the field turns red and says why when it asks for more than the wallet
 * holds, so a button is never disabled without a word. Shared by the Trading Balance, the private balance and the
 * copy drawer's inline deposit.
 */
export interface AmountFieldProps {
  value: string;
  onChange: (text: string) => void;
  decimals: number;
  symbol: string;
  /** What the wallet can move; null while it is being read. */
  maxBase: bigint | null;
  label: string;
  className?: string;
}

export function amountProblem(value: string, decimals: number, maxBase: bigint | null, symbol: string): string | null {
  if (value.trim() === "") return null;
  const base = parseDecimalToBaseUnits(value.trim(), decimals);
  if (base === null) return VAULT.amount.notANumber;
  if (maxBase !== null && base > maxBase) return VAULT.amount.overWallet(`${formatBaseUnits(maxBase, decimals)} ${symbol}`);
  return null;
}

export function AmountField({ value, onChange, decimals, symbol, maxBase, label, className }: AmountFieldProps) {
  const problem = amountProblem(value, decimals, maxBase, symbol);
  return (
    <div className={cn("vault-amount", className)} data-invalid={problem ? "" : undefined}>
      <div className="vault-amount-row">
        <input type="text" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="vault-input" aria-label={label} aria-invalid={problem ? true : undefined} placeholder="0.00" />
        <button type="button" className="vault-max" disabled={maxBase === null || maxBase <= 0n} onClick={() => maxBase !== null && onChange(formatBaseUnits(maxBase, decimals, { minDp: 0 }).replace(/,/g, ""))}>
          {VAULT.amount.max}
        </button>
      </div>
      {problem ? <span className="vault-amount-problem" role="alert">{problem}</span> : maxBase !== null && <span className="vault-amount-hint">{VAULT.amount.walletHolds(`${formatBaseUnits(maxBase, decimals)} ${symbol}`)}</span>}
    </div>
  );
}
