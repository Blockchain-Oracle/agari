"use client";

import { minStakeBase } from "@masayume/core/sizing";
import { formatBaseUnits } from "@masayume/core/units";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { TICKET } from "@/lib/copy";

interface StakeInputProps {
  value: string;
  onChange: (text: string) => void;
  decimals: number;
  symbol: string;
  /** Debounced expected cost, announced to screen readers as it settles. */
  costBase: bigint | null;
}

/** Keeps only digits and a single decimal point; the parser downstream rejects anything else anyway. */
function sanitize(text: string): string {
  const cleaned = text.replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${whole}.${rest.join("")}` : whole;
}

export function StakeInput({ value, onChange, decimals, symbol, costBase }: StakeInputProps) {
  const floorId = useId();
  const floorText = `${formatBaseUnits(minStakeBase(decimals), decimals, { minDp: 0 })} ${symbol}`;

  return (
    <label className="flex flex-col gap-1">
      <span className="type-label-micro text-ink-muted">{TICKET.stakeLabel}</span>
      <div className="flex items-center gap-2">
        <Input
          inputMode="decimal"
          autoComplete="off"
          value={value}
          placeholder={TICKET.stakePlaceholder}
          aria-describedby={floorId}
          onChange={(event) => onChange(sanitize(event.target.value))}
          className="type-data-lg numbers text-ink"
        />
        <span className="type-caption text-ink-secondary">{symbol}</span>
      </div>
      <span id={floorId} className="type-caption text-ink-muted">
        {TICKET.minStake(floorText)}
      </span>
      <span className="sr-only" aria-live="polite">
        {costBase !== null ? TICKET.srCost(`${formatBaseUnits(costBase, decimals)} ${symbol}`) : ""}
      </span>
    </label>
  );
}
