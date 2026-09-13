import { cn } from "@/lib/utils";
import { TickerItem, type TickerEntry } from "./TickerItem";

interface TickerProps {
  entries: readonly TickerEntry[];
  className?: string;
}

/** Persistent price strip: carries real signal or freezes with a tick — never scrolls stale numbers. */
export function Ticker({ entries, className }: TickerProps) {
  return (
    <div
      role="list"
      aria-label="Prices"
      className={cn(
        "flex h-(--ticker-height) shrink-0 items-center gap-6 overflow-x-auto border-b border-hairline bg-ground px-gutter lg:px-gutter-desktop",
        className,
      )}
    >
      {entries.map((entry) => (
        <TickerItem key={entry.asset} {...entry} />
      ))}
    </div>
  );
}
