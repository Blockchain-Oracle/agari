"use client";

import { formatBaseUnits, parseDecimalToBaseUnits } from "@masayume/core/units";
import { TRADE_FROM_X } from "./copy";
import { Dot } from "./StepSpine";
import { X_GRANT } from "./useXGrant";

const PRESETS = ["5", "10", "25"] as const;

interface CapabilityReceiptProps {
  amount: string;
  setAmount: (value: string) => void;
  disabled: boolean;
  depositing: boolean;
  /** True the first time: the vault's ERC-20 allowance is absorbed into this action (two signatures). */
  firstTime: boolean;
  decimals: number;
  symbol: string;
  onDeposit: (amountBase: bigint) => void;
}

/** Show the X allocation and the executor's authority before wallet confirmation. */
export function CapabilityReceipt({ amount, setAmount, disabled, depositing, firstTime, decimals, symbol, onDeposit }: CapabilityReceiptProps) {
  const amountBase = parseDecimalToBaseUnits(amount || "0", decimals) ?? 0n;
  const shown = amountBase > 0n ? formatBaseUnits(amountBase, decimals) : "—";
  const [l1, l2, l3, l4, l5] = TRADE_FROM_X.receipt.lede(shown, symbol);
  const [c1, c2, c3, c4, c5] = TRADE_FROM_X.receipt.canText(shown, X_GRANT.openWindows);
  const [n1, n2, n3] = TRADE_FROM_X.receipt.line(shown, symbol);
  return (
    <div>
      <p className="xt-rcpt-lede">
        {l1}<strong>{l2}</strong>{l3}<em>{l4}</em>{l5}
      </p>
      <div className="xt-amount-row">
        <div className="xt-amount">
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" disabled={disabled} aria-label={TRADE_FROM_X.receipt.amountAria} />
          <span className="xt-amount-unit">{symbol}</span>
        </div>
        {PRESETS.map((p) => (
          <button key={p} type="button" onClick={() => setAmount(p)} disabled={disabled} className="xt-preset">
            +{p}
          </button>
        ))}
      </div>
      <div className="xt-ledger">
        <div className="xt-ledger-cell xt-ledger-cell--can">
          <div className="xt-ledger-head xt-ledger-head--can">
            <Dot /> {TRADE_FROM_X.receipt.can}
          </div>
          <div className="xt-ledger-text">
            {c1}<strong>{c2}</strong>{c3}<strong>{c4}</strong>{c5}
          </div>
        </div>
        <div className="xt-ledger-cell xt-ledger-cell--cannot">
          <div className="xt-ledger-head xt-ledger-head--cannot">
            <Dot v /> {TRADE_FROM_X.receipt.cannot}
          </div>
          <div className="xt-ledger-text xt-ledger-text--cannot">
            <span className="xt-struck">{TRADE_FROM_X.receipt.cannotStruck}</span>
            {TRADE_FROM_X.receipt.cannotTail}
          </div>
        </div>
      </div>
      <div className="xt-line">
        {n1}<strong>{n2}</strong>{n3}
      </div>
      <button type="button" onClick={() => onDeposit(amountBase)} disabled={disabled || depositing || amountBase <= 0n} className="xt-cta xt-cta-btn xt-cta-btn--wide">
        {depositing ? TRADE_FROM_X.receipt.busy : firstTime ? TRADE_FROM_X.receipt.ctaApprove : TRADE_FROM_X.receipt.cta}
      </button>
    </div>
  );
}
