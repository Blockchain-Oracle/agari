"use client";

import { parseDecimalToBaseUnits } from "@agari/core/units";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AmountField } from "../vault/AmountField";
import { useVaultWrite } from "../vault/useVaultWrite";
import type { CopyFormCheck } from "./copy-form";
import { COPY_FORM } from "./copy-form-copy";
import { money } from "./format";
import "../vault/vault.css";
import "./copy-form.css";

/**
 * The copy drawer's money and limits (S23): the two fields with a Max and a red reason each, a strip that shows the
 * wallet, the Trading Balance and what this setup takes, an inline deposit to the Trading Balance, and the confirm
 * button that always says why it is off. An invalid press shakes the form instead of doing nothing.
 */
export interface CopyFormFieldsProps {
  check: CopyFormCheck;
  budget: string;
  perTrade: string;
  setBudget: (text: string) => void;
  setPerTrade: (text: string) => void;
  /** A saved setup's fixed numbers, shown instead of the typed ones. */
  fixed: { budget: string; perTrade: string } | null;
  fieldsDisabled: boolean;
  decimals: number;
  symbol: string;
  walletBase: bigint | null;
  vaultAvailableBase: bigint;
  feeBase: bigint | null;
  confirmLabel: string;
  confirmBusy: boolean;
  onConfirm: () => void;
  /** The limits sentence, the fee and the warnings, between the fields and the button. */
  children?: ReactNode;
}

function Field({ label, symbol, value, onChange, error, disabled, onMax, maxDisabled }: { label: string; symbol: string; value: string; onChange: (v: string) => void; error: string | null; disabled: boolean; onMax: () => void; maxDisabled: boolean }) {
  return (
    <label className="desk-field-label block" data-invalid={error ? "" : undefined}>
      {label} · <span className="sym">{symbol}</span>
      <span className="copy-field-row mt-2">
        <input className={cn("strat-input", error && "copy-field-bad")} inputMode="decimal" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder="0.00" aria-invalid={error ? true : undefined} />
        <button type="button" className="copy-field-max" disabled={disabled || maxDisabled} onClick={onMax}>{COPY_FORM.max}</button>
      </span>
      {error && <span className="copy-field-error" role="alert">{error}</span>}
    </label>
  );
}

export function CopyFormFields(p: CopyFormFieldsProps) {
  const reduce = useReducedMotion();
  const shake = useAnimationControls();
  const vault = useVaultWrite();
  const [adding, setAdding] = useState(false);
  const [deposit, setDeposit] = useState("");
  const depositBase = parseDecimalToBaseUnits(deposit.trim(), p.decimals) ?? 0n;
  const { check } = p;
  const text = (base: bigint) => money(base, p.decimals).replace(/,/g, "");

  const press = () => {
    if (check.blockedBy === null) return p.onConfirm();
    if (!reduce) void shake.start({ x: [0, -7, 7, -5, 5, 0], transition: { duration: 0.36 } });
  };

  return (
    <motion.div className="space-y-4" animate={shake}>
      <div className="copy-strip" aria-label={COPY_FORM.strip.pulls}>
        <div><span>{COPY_FORM.strip.wallet}</span><b>{p.walletBase === null ? "—" : money(p.walletBase, p.decimals, p.symbol)}</b></div>
        <div><span>{COPY_FORM.strip.vault}</span><b>{money(p.vaultAvailableBase, p.decimals, p.symbol)}</b></div>
        <div data-tone={check.budgetError ? "bad" : undefined}><span>{COPY_FORM.strip.pulls}</span><b>{money(check.topUpBase + (p.feeBase ?? 0n), p.decimals, p.symbol)}</b><small>{COPY_FORM.strip.pullsDetail(p.feeBase ? money(p.feeBase, p.decimals, p.symbol) : null)}</small></div>
      </div>
      <Field label="Total budget" symbol={p.symbol} value={p.fixed?.budget ?? p.budget} onChange={p.setBudget} error={check.budgetError} disabled={p.fieldsDisabled} maxDisabled={check.maxBudgetBase === null || check.maxBudgetBase <= 0n} onMax={() => check.maxBudgetBase !== null && p.setBudget(text(check.maxBudgetBase))} />
      <Field label="Most per trade" symbol={p.symbol} value={p.fixed?.perTrade ?? p.perTrade} onChange={p.setPerTrade} error={check.perTradeError} disabled={p.fieldsDisabled} maxDisabled={check.maxPerTradeBase <= 0n} onMax={() => p.setPerTrade(text(check.maxPerTradeBase))} />
      <div className="copy-add">
        <button type="button" className="copy-add-toggle" aria-expanded={adding} onClick={() => setAdding((a) => !a)}>{adding ? "−" : "+"} {COPY_FORM.addFunds.toggle}</button>
        {adding && (
          <div className="copy-add-body">
            <AmountField value={deposit} onChange={setDeposit} decimals={p.decimals} symbol={p.symbol} maxBase={p.walletBase} label={COPY_FORM.addFunds.label} />
            <button type="button" className="desk-pill" disabled={vault.state.busy !== null || !vault.hasSigner || depositBase <= 0n || p.walletBase === null || depositBase > p.walletBase} onClick={() => void vault.run({ kind: "vault-deposit", amountBase: depositBase }, COPY_FORM.addFunds.landed).then((o) => { if (o?.status === "confirmed") setDeposit(""); })}>
              {vault.state.busy === "vault-deposit" ? COPY_FORM.addFunds.depositing : COPY_FORM.addFunds.deposit}
            </button>
          </div>
        )}
      </div>
      {p.children}
      <div>
        <button type="button" className="desk-btn-primary w-full" data-blocked={check.blockedBy ? "" : undefined} aria-disabled={check.blockedBy !== null} disabled={p.confirmBusy} onClick={press}>{p.confirmLabel}</button>
        {check.blockedBy && <p className="copy-blocked" role="status">{check.blockedBy}</p>}
      </div>
    </motion.div>
  );
}
