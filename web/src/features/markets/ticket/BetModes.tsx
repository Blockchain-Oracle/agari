"use client";

import { TICKET_PENDING } from "@/lib/copy";

export type BetMode = "dir" | "range";

interface BetModesProps {
  mode: BetMode;
  onChange: (mode: BetMode) => void;
  /** The RangeReserve is deployed on this network; without it the control stays and says what is missing. */
  rangeAvailable: boolean;
}

/**
 * Call a side, or call a band (`Ticket624Drawer.tsx` L857–870).
 *
 * Range settles against `RangeReserve`; where it is not deployed the control is disabled and names what
 * is missing, because pointing it at an ordinary Up/Down order would be a different bet wearing this one's label.
 */
export function BetModes({ mode, onChange, rangeAvailable }: BetModesProps) {
  return (
    <div className="tk-modes" role="group" aria-label={TICKET_PENDING.modeLabel}>
      <button type="button" className="tk-mode" aria-pressed={mode === "dir"} onClick={() => onChange("dir")} data-cursor="hover">
        {TICKET_PENDING.modeDirection}
      </button>
      <button
        type="button"
        className="tk-mode"
        aria-pressed={mode === "range"}
        disabled={!rangeAvailable}
        title={rangeAvailable ? undefined : TICKET_PENDING.rangePending}
        onClick={() => onChange("range")}
        data-cursor="hover"
      >
        {TICKET_PENDING.modeRange}
      </button>
    </div>
  );
}
