"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { EXPIRY_CHOICES, type CapsForm } from "./caps";
import { SESSION } from "./copy";

interface CapsEditorProps {
  form: CapsForm;
  onChange: (form: CapsForm) => void;
  symbol: string;
  disabled: boolean;
}

function sanitizeDecimal(text: string): string {
  const cleaned = text.replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${whole}.${rest.join("")}` : whole;
}

function Field({ label, hint, children, id }: { label: string; hint?: string; children: React.ReactNode; id: string }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="tk-control-label">{label}</span>
      {children}
      {hint && <span className="type-caption text-ink-muted">{hint}</span>}
    </label>
  );
}

/** The caps, one field each, in the Ticket's own input grammar; the expiry is the leverage-chip row. */
export function CapsEditor({ form, onChange, symbol, disabled }: CapsEditorProps) {
  const id = useId();
  const money = (key: "perTradeText" | "dailyText" | "depositText", label: string, hint?: string) => (
    <Field id={`${id}-${key}`} label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <Input
          id={`${id}-${key}`}
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          value={form[key]}
          onChange={(event) => onChange({ ...form, [key]: sanitizeDecimal(event.target.value) })}
          className="numbers text-ink"
        />
        <span className="type-caption text-ink-secondary">{symbol}</span>
      </div>
    </Field>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {money("perTradeText", SESSION.sheet.perTrade)}
        {money("dailyText", SESSION.sheet.daily)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id={`${id}-positions`} label={SESSION.sheet.positions}>
          <Input
            id={`${id}-positions`}
            inputMode="numeric"
            disabled={disabled}
            value={String(form.positions)}
            onChange={(event) => onChange({ ...form, positions: Number(event.target.value.replace(/\D/g, "") || 0) })}
            className="numbers text-ink"
          />
        </Field>
        <Field id={`${id}-price`} label={SESSION.sheet.price} hint={SESSION.sheet.priceHint}>
          <div className="flex items-center gap-2">
            <Input
              id={`${id}-price`}
              inputMode="numeric"
              disabled={disabled}
              value={String(form.priceCents)}
              onChange={(event) => onChange({ ...form, priceCents: Number(event.target.value.replace(/\D/g, "") || 0) })}
              className="numbers text-ink"
            />
            <span className="type-caption text-ink-secondary">¢</span>
          </div>
        </Field>
      </div>
      <div className="tk-lev-row">
        <span className="tk-control-label">{SESSION.sheet.expiry}</span>
        <div className="tk-levs" role="group" aria-label={SESSION.sheet.expiry}>
          {EXPIRY_CHOICES.map((choice) => (
            <button
              key={choice.hours}
              type="button"
              className="tk-lev"
              aria-pressed={form.expiryHours === choice.hours}
              disabled={disabled}
              onClick={() => onChange({ ...form, expiryHours: choice.hours })}
              data-cursor="hover"
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>
      {money("depositText", SESSION.sheet.deposit, SESSION.sheet.depositHint)}
    </div>
  );
}
