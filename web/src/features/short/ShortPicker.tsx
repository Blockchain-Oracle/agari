"use client";

import type { EventMarket } from "@agari/core/types";
import { Countdown } from "@/components/data";
import { formatCadence } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { useTopOfBook } from "../markets/hero/useTopOfBook";
import { SHORT } from "./copy";
import type { ShortStock } from "./useShortWindows";

interface ShortPickerProps {
  stocks: ShortStock[];
  loading: boolean;
  selected: EventMarket | null;
  onSelect: (market: EventMarket) => void;
  nowMs: number;
}

/**
 * Pick the stock, then how long to hold it.
 *
 * Only the chosen stock's Windows are priced, and each prices itself from the top of its own book — the Down
 * ask, which is literally what a dollar of the fall costs right now. An empty side reads "—" rather than a
 * number nobody is resting.
 */
export function ShortPicker({ stocks, loading, selected, onSelect, nowMs }: ShortPickerProps) {
  const { picker } = SHORT;
  if (loading) return <p className="sh-picker-note">{picker.loading}</p>;
  if (stocks.length === 0) {
    return (
      <div className="sh-picker-empty">
        <p className="sh-picker-empty-t">{picker.noneTitle}</p>
        <p className="sh-picker-empty-d">{picker.noneBody}</p>
      </div>
    );
  }
  const stock = stocks.find((s) => s.windows.some((w) => w.marketId === selected?.marketId)) ?? stocks[0];
  // `stocks` is non-empty here, but every stock is also guaranteed at least one Window by `useShortWindows`.
  if (!stock) return <p className="sh-picker-note">{picker.loading}</p>;
  return (
    <div className="sh-picker">
      <span className="sh-k">{picker.stock}</span>
      <div className="sh-stocks" role="group" aria-label={picker.stock}>
        {stocks.map((s) => (
          <button
            key={s.asset}
            type="button"
            aria-pressed={s.asset === stock.asset}
            onClick={() => s.windows[0] && onSelect(s.windows[0])}
            className={cn("sh-stock", s.asset === stock.asset && "sh-stock--on")}
            data-cursor="hover"
          >
            <span className="sh-stock-a">{s.asset}</span>
            <span className="sh-stock-n">{picker.windows(s.windows.length)}</span>
          </button>
        ))}
      </div>

      <span className="sh-k sh-k--gap">{picker.window}</span>
      <div className="sh-windows" role="group" aria-label={picker.window}>
        {stock.windows.map((market) => (
          <WindowChip key={market.marketId} market={market} on={market.marketId === selected?.marketId} onSelect={onSelect} nowMs={nowMs} />
        ))}
      </div>
    </div>
  );
}

function WindowChip({ market, on, onSelect, nowMs }: { market: EventMarket; on: boolean; onSelect: (m: EventMarket) => void; nowMs: number }) {
  const { picker } = SHORT;
  const { downCents, hydrating } = useTopOfBook(market);
  return (
    <button type="button" aria-pressed={on} onClick={() => onSelect(market)} className={cn("sh-window", on && "sh-window--on")} data-cursor="hover">
      <span className="sh-window-c">{formatCadence(market.intervalSec)}</span>
      <span className="sh-window-t">
        <Countdown expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} /> {picker.left}
      </span>
      <span className="sh-window-p">
        <span className="sh-window-pk">{picker.costLabel}</span>
        <span className="sh-window-pv numbers">{hydrating ? picker.costPending : downCents === null ? picker.costNone : picker.cost(downCents)}</span>
      </span>
    </button>
  );
}
