"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PARLAY } from "./copy";

/** The ticket's `Row` (`ParlayBuilder.tsx` L553–564). */
export function Row({ label, children, emphasize, accent }: { label: string; children: ReactNode; emphasize?: boolean; accent?: boolean }) {
  return (
    <div className="pl-row">
      <span className="pl-row-label">{label}</span>
      <span className={cn("pl-row-val", emphasize && "pl-row-val--emph", accent && "pl-row-val--accent")}>{children}</span>
    </div>
  );
}

/** The ticket's `AmountField` (L566–589): a decimal input with the unit pinned at its right edge. */
export function AmountField({ label, value, onChange, hint, symbol }: { label: string; value: string; onChange: (v: string) => void; hint?: string; symbol: string }) {
  return (
    <div>
      <div className="pl-field-head">
        <label className="pl-field-label">{label}</label>
        {hint && <span className="pl-field-hint">{hint}</span>}
      </div>
      <div className="pl-field-input">
        <input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.00" min="0" step="1" inputMode="decimal" className="pl-input" aria-label={label} />
        <span className="pl-input-unit">{symbol}</span>
      </div>
    </div>
  );
}

export type PlaceStep = "idle" | "placing" | "success" | "error";

export interface PlaceLabels {
  placing: string;
  placed: string;
  pricing: string;
  unavailable: string;
  insufficient: (symbol: string) => string;
  place: (stake: string, symbol: string) => string;
  build: string;
}

export interface PlaceButtonProps {
  step: PlaceStep;
  quoted: boolean;
  quoteLoading: boolean;
  quoteError: boolean;
  hasEnough: boolean;
  stakeText: string;
  symbol: string;
  onPlace: () => void;
  /** Another feature's words on the same ladder (the range ticket); the parlay's by default. */
  labels?: PlaceLabels;
}

/** The place control's ladder (L464–489), in the reference's order. */
export function PlaceButton({ step, quoted, quoteLoading, quoteError, hasEnough, stakeText, symbol, onPlace, labels }: PlaceButtonProps) {
  const disabled = !quoted || quoteLoading || quoteError || !hasEnough || step === "placing" || step === "success";
  const muted = (!quoted || !hasEnough) && step === "idle";
  const ticket: PlaceLabels = labels ?? PARLAY.ticket;
  return (
    <button type="button" onClick={onPlace} disabled={disabled} className={cn("pl-place", muted && "pl-place--muted")} data-cursor="hover">
      {step === "placing" ? (
        <span className="pl-place-inner">
          <Loader2 className="animate-spin" /> {ticket.placing}
        </span>
      ) : step === "success" ? (
        <span className="pl-place-inner">
          <Check /> {ticket.placed}
        </span>
      ) : quoteLoading ? (
        ticket.pricing
      ) : quoteError ? (
        ticket.unavailable
      ) : !hasEnough ? (
        ticket.insufficient(symbol)
      ) : quoted ? (
        ticket.place(stakeText, symbol)
      ) : (
        ticket.build
      )}
    </button>
  );
}

export interface ErrorLabels {
  technical: string;
  tryAgain: string;
}

/** The error block (L496–517): a headline, the technical detail behind a disclosure, and a way back. */
export function ErrorBlock({ title, detail, onReset, labels }: { title: string; detail: string; onReset: () => void; labels?: ErrorLabels }) {
  const words: ErrorLabels = labels ?? PARLAY.ticket;
  return (
    <div className="pl-err pl-drop" role="alert">
      <AlertCircle />
      <div className="pl-err-body">
        <p className="pl-err-title">{title}</p>
        {detail && detail !== title && (
          <details className="pl-err-details">
            <summary className="pl-err-summary">{words.technical}</summary>
            <p className="pl-err-detail">{detail}</p>
          </details>
        )}
        <button type="button" onClick={onReset} className="pl-err-retry">
          {words.tryAgain}
        </button>
      </div>
    </div>
  );
}
