"use client";

import { minStakeBase } from "@masayume/core/sizing";
import { formatBaseUnits, oneUnit } from "@masayume/core/units";
import { useId } from "react";
import { TICKET } from "@/lib/copy";
import { LeverageChips, type LeverageChipsProps } from "./LeverageChips";

/** The reference's additive chips (`Ticket624Drawer.tsx` L1067–1073): the amount is always the user's. */
const ADDS = [1, 5, 20] as const;

interface AmountBlockProps {
  value: string;
  onChange: (text: string) => void;
  stakeBase: bigint;
  onStakeBase: (base: bigint) => void;
  /** Wallet plus credit — the real buying power, as one number; null until read. */
  balanceBase: bigint | null;
  decimals: number;
  symbol: string;
  /** The reference's `belowMinHard`: said only once there is an amount to judge. */
  belowMin: boolean;
  /** The 1×/2×/3× chips on the row's right; null on a range bet, which the reference places at 1× only. */
  leverage: LeverageChipsProps | null;
  /** Debounced expected cost, announced to screen readers as it settles. */
  costBase: bigint | null;
}

/** Keeps only digits and a single decimal point; the parser downstream rejects anything else anyway. */
function sanitize(text: string): string {
  const cleaned = text.replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${whole}.${rest.join("")}` : whole;
}

/**
 * Amount + leverage — the only sizing controls, as one bordered block (`Ticket624Drawer.tsx` L1045–1095).
 *
 * The header row names the amount and shows the balance beside it; the input is the big display figure
 * with the unit after it; one row carries the additive `+1 +5 +20` chips on the left and the leverage
 * chips on the right. The ¼/½/¾/Max fraction chips this replaced were ours, not the reference's, and
 * "Max" on a thin book was the whole of "it lets me place more than there is".
 */
export function AmountBlock({ value, onChange, stakeBase, onStakeBase, balanceBase, decimals, symbol, belowMin, leverage, costBase }: AmountBlockProps) {
  const minId = useId();
  const add = (units: number) => onStakeBase(stakeBase + BigInt(units) * oneUnit(decimals));
  return (
    <div className="tk-amount">
      <div className="tk-amount-head">
        <span className="tk-amount-label">{TICKET.amount}</span>
        {balanceBase !== null && <span className="tk-amount-balance">{TICKET.balance(formatBaseUnits(balanceBase, decimals))}</span>}
      </div>
      <div className="tk-amount-field">
        <input
          inputMode="decimal"
          autoComplete="off"
          placeholder={TICKET.stakePlaceholder}
          value={value}
          onChange={(event) => onChange(sanitize(event.target.value))}
          className="tk-amount-input"
          aria-label={TICKET.amountAria(symbol)}
          aria-describedby={belowMin ? minId : undefined}
        />
        <span className="tk-amount-unit">{symbol}</span>
      </div>
      <div className="tk-amount-row">
        <div className="tk-adds">
          {ADDS.map((units) => (
            <button key={units} type="button" className="tk-add" onClick={() => add(units)} data-cursor="hover">
              +{units}
            </button>
          ))}
        </div>
        {leverage && <LeverageChips {...leverage} />}
      </div>
      {belowMin && (
        <p id={minId} className="tk-amount-min">
          {TICKET.minimum(`${formatBaseUnits(minStakeBase(decimals), decimals, { minDp: 0 })} ${symbol}`)}
        </p>
      )}
      <span className="sr-only" aria-live="polite">
        {costBase !== null ? TICKET.srCost(`${formatBaseUnits(costBase, decimals)} ${symbol}`) : ""}
      </span>
    </div>
  );
}
