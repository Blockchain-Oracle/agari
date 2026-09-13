"use client";

import { quickChips } from "@masayume/core/sizing";
import { Button } from "@/components/ui/button";
import { TICKET } from "@/lib/copy";

interface QuickChipsProps {
  /** Wallet spendable plus venue credit; null until known — chips stay quiet rather than guessing a balance. */
  availableBase: bigint | null;
  decimals: number;
  onPick: (stakeBase: bigint) => void;
}

/** ¼ · ½ · ¾ · Max of what you can actually spend; a chip below the floor is disabled and says why (FR-8). */
export function QuickChips({ availableBase, decimals, onPick }: QuickChipsProps) {
  if (availableBase === null) return null;
  const chips = quickChips(availableBase, decimals);
  return (
    <div role="group" aria-label={TICKET.chips} className="grid grid-cols-4 gap-2">
      {chips.map((chip) => (
        <Button
          key={chip.label}
          variant="secondary"
          size="sm"
          disabled={!chip.enabled}
          title={chip.enabled ? undefined : TICKET.chipBelowMin}
          aria-label={chip.enabled ? chip.label : `${chip.label} — ${TICKET.chipBelowMin}`}
          onClick={() => onPick(chip.stakeBase)}
          className="numbers"
        >
          {chip.label}
        </Button>
      ))}
    </div>
  );
}
