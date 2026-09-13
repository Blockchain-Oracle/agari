"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STRATEGIES } from "./copy";
import { AmountRow, CapsEditor, MaxChip, RiskModePicker } from "./DeskInputs";
import type { RiskMode } from "./format";
import "./desk.css";

const D = STRATEGIES.desk;

/** The heartbeat line: the reference reads the keeper's own pulse and never says "copying" on a dead desk. */
export function DeskPulse({ live, label }: { live: boolean; label: string }) {
  return (
    <div className={cn("desk-pulse", live ? "border-vermilion" : "border-ink/25")}>
      <span className={cn("desk-status", live ? "text-vermilion" : "text-ink/50")}>
        <span className={cn("desk-dot", live ? "desk-live-dot bg-vermilion" : "bg-ink/40")} />
        {label}
      </span>
    </div>
  );
}

export function DeskNotice({ eyebrow, body, cta, onCta, busy, quiet }: { eyebrow: string; body: string; cta: string; onCta: () => void; busy?: boolean; quiet?: boolean }) {
  return (
    <div className={cn("desk-notice", quiet && "desk-notice--quiet")}>
      <p className={cn("desk-status mb-1", quiet ? "text-ink/60" : "text-vermilion")}>{eyebrow}</p>
      <p className={cn("desk-copy", quiet ? "text-ink/60" : "text-ink/70")}>{body}</p>
      <button type="button" onClick={onCta} disabled={busy} className={cn("desk-link-btn", quiet && "desk-link-btn--quiet")}>
        {cta}
      </button>
    </div>
  );
}

export function ManageChip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("desk-pill", on && "desk-pill--on")}>
      {label}
    </button>
  );
}

interface PanelProps {
  symbol: string;
  busy: string | null;
}

export function AddPanel({ symbol, busy, value, onChange, walletText, faucet, onSubmit }: PanelProps & { value: string; onChange: (s: string) => void; walletText: string; faucet: ReactNode; onSubmit: () => void }) {
  return (
    <div className="max-w-md">
      <AmountRow
        value={value}
        onChange={onChange}
        symbol={symbol}
        hint={
          <span>
            {D.addHint(walletText)}
            {faucet}
          </span>
        }
        chips={[1, 5]}
        onChip={(n) => onChange(String(Math.max(0, (parseFloat(value || "0") || 0) + n)))}
        action={
          <button type="button" onClick={onSubmit} disabled={busy === "add"} className="desk-btn-primary">
            {busy === "add" ? D.adding : D.addCta}
          </button>
        }
      />
    </div>
  );
}

export function WithdrawPanel({ symbol, busy, value, onChange, maxText, onSubmit }: PanelProps & { value: string; onChange: (s: string) => void; maxText: string | null; onSubmit: () => void }) {
  return (
    <div className="max-w-md">
      <AmountRow
        value={value}
        onChange={onChange}
        symbol={symbol}
        hint={<span>{D.withdrawHint}</span>}
        chips={[]}
        onChip={() => undefined}
        extra={maxText ? <MaxChip onClick={() => onChange(maxText)} /> : null}
        action={
          <button type="button" onClick={onSubmit} disabled={busy === "withdraw"} className="desk-btn-ghost">
            {busy === "withdraw" ? D.withdrawing : D.manage.withdraw}
          </button>
        }
      />
    </div>
  );
}

export function CapsPanel({ symbol, busy, mode, setMode, capStr, setCapStr, suggested, onSubmit }: PanelProps & { mode: RiskMode; setMode: (m: RiskMode) => void; capStr: string; setCapStr: (s: string) => void; suggested: string; onSubmit: () => void }) {
  return (
    <div className="max-w-md space-y-3">
      <RiskModePicker value={mode} onChange={setMode} />
      <CapsEditor capStr={capStr} setCapStr={setCapStr} suggested={suggested} symbol={symbol} />
      <button type="button" onClick={onSubmit} disabled={busy === "caps"} className="desk-btn-primary">
        {busy === "caps" ? D.signing : D.saveCaps(mode)}
      </button>
    </div>
  );
}
