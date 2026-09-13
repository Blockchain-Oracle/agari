import { formatCadence } from "@masayume/core/copy";
import type { EventMarket } from "@masayume/core/types";
import { TICKET } from "@/lib/copy";

interface AutoAdvanceNoteProps {
  from: EventMarket;
  to: EventMarket;
}

export function AutoAdvanceNote({ from, to }: AutoAdvanceNoteProps) {
  return (
    <p role="status" className="type-caption text-ink-secondary">
      {TICKET.advanced(formatCadence(from.intervalSec), formatCadence(to.intervalSec))}
    </p>
  );
}
