import { StaleTick } from "@/components/states/StaleTick";
import { cn } from "@/lib/utils";

export type TickerDirection = "up" | "down" | "flat";

export interface TickerEntry {
  asset: string;
  priceText: string;
  direction: TickerDirection;
  /** When set the price is frozen at its last-good value and the tick says so. */
  staleAsOfMs?: number;
}

// The one chrome element allowed direction color — it IS money direction.
const DIRECTION = {
  up: { glyph: "▲", ink: "text-profit", word: "up" },
  down: { glyph: "▼", ink: "text-loss", word: "down" },
  flat: { glyph: "–", ink: "text-ink-muted", word: "flat" },
} as const;

export function TickerItem({ asset, priceText, direction, staleAsOfMs }: TickerEntry) {
  const d = DIRECTION[direction];
  return (
    <div role="listitem" className="flex shrink-0 items-center gap-2">
      <span className="type-label-micro text-ink-secondary">{asset}</span>
      <span className="type-data text-ink">{priceText}</span>
      <span className={cn("type-data", d.ink)} aria-label={d.word}>
        {d.glyph}
      </span>
      {staleAsOfMs !== undefined && <StaleTick asOfMs={staleAsOfMs} compact />}
    </div>
  );
}
