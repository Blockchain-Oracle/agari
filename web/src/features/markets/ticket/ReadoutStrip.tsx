"use client";

import { TICKET } from "@/lib/copy";

export interface ReadoutCells {
  cost: string | null;
  ret: string | null;
  loss: string | null;
}

interface ReadoutStripProps {
  cells: ReadoutCells;
  /** A live quote is on screen: the strip's rule turns vermilion (`border-vermilion/30`). */
  live: boolean;
  /** The one caption line under the strip — where the number comes from, or why there is none. */
  caption: string;
  /** "62% chance", right-aligned, only with a live quote. */
  chance: string | null;
  /** The reference's one sentence when leverage is on: "2× can knock out before expiry." */
  note?: string | null;
}

function Cell({ label, value, accent = false }: { label: string; value: string | null; accent?: boolean }) {
  return (
    <div className="tk-readout-cell">
      <span className="tk-readout-label">{label}</span>
      <span className={`tk-readout-value${accent ? " tk-readout-value--accent" : ""}`}>{value ?? "—"}</span>
    </div>
  );
}

/**
 * Current cost · Return · Max loss, in three divided columns (`Ticket624Drawer.tsx` L1098–1121), and the
 * caption line beneath. Every kind of bet the ticket can compose — a plain order, a boost, a private
 * bet, a band — feeds the same three cells, so switching leverage or route changes numbers and never the
 * shape of the ticket. The four-row list and the boost card this replaced grew and shrank under the thumb.
 */
export function ReadoutStrip({ cells, live, caption, chance, note = null }: ReadoutStripProps) {
  return (
    <>
      <div className={`tk-readout${live ? " tk-readout--live" : ""}`}>
        <Cell label={TICKET.currentCost} value={cells.cost} />
        <Cell label={TICKET.ret} value={cells.ret} accent={cells.ret !== null} />
        <Cell label={TICKET.maxLoss} value={cells.loss} />
      </div>
      <div className="tk-caption">
        <span>{caption}</span>
        {chance && <span className="tk-caption-chance">{chance}</span>}
      </div>
      {note && <p className="tk-note">{note}</p>}
    </>
  );
}
