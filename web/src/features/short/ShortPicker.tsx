"use client";

import type { EventMarket } from "@agari/core/types";
import { useState } from "react";
import { Countdown } from "@/components/data";
import { EmptyState } from "@/components/ui/desk-kit";
import { useDeskMarks } from "@/features/desk/useDeskMarks";
import { formatCadence } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { CalendarClock } from "lucide-react";
import { useTopOfBook } from "../markets/hero/useTopOfBook";
import { SHORT } from "./copy";
import { ShortAssetPicker, ShortPickSummary } from "./ShortAssetPicker";
import { isLiveWindow, opensAt, type ShortKind, type ShortStock } from "./useShortWindows";

interface ShortPickerProps {
  stocks: ShortStock[];
  loading: boolean;
  selected: EventMarket | null;
  onSelect: (market: EventMarket) => void;
  nowMs: number;
}

type Filter = "all" | "stock" | "allDay";
const FILTER_KINDS: Record<Filter, readonly ShortKind[] | null> = { all: null, stock: ["stock"], allDay: ["preIpo", "basket"] };

/**
 * Pick what to short, then how long (S23, compact since S24): every asset as a small logo card (a snap row on a phone),
 * grouped tradable-first while the bell is shut, a filter for stocks against the 24/7 names, the chosen asset in full
 * once, its cadences as chips, then its Windows — the live ones priced from their own Down ask, the later ones with the
 * time they open.
 */
export function ShortPicker({ stocks, loading, selected, onSelect, nowMs }: ShortPickerProps) {
  const { picker } = SHORT;
  const marks = useDeskMarks();
  const [filter, setFilter] = useState<Filter>("all");
  if (loading) return <div className="sh-picker"><span className="sh-skel sh-skel-cards" aria-label={picker.loading} /></div>;
  if (stocks.length === 0) return <EmptyState icon={<CalendarClock />} title={picker.noneTitle} body={picker.noneBody} />;

  const kinds = FILTER_KINDS[filter];
  const shown = kinds ? stocks.filter((s) => kinds.includes(s.kind)) : stocks;
  const stock = stocks.find((s) => s.windows.some((w) => w.marketId === selected?.marketId)) ?? shown[0] ?? stocks[0];
  if (!stock) return null;
  const cadences = [...new Set(stock.windows.map((w) => w.intervalSec))].sort((a, b) => a - b);
  const cadence = selected && selected.asset === stock.asset ? selected.intervalSec : (cadences[0] ?? 0);
  const windows = stock.windows.filter((w) => w.intervalSec === cadence);
  const counts: Record<Filter, number> = { all: stocks.length, stock: stocks.filter((s) => s.kind === "stock").length, allDay: stocks.filter((s) => s.kind !== "stock").length };

  return (
    <div className="sh-picker">
      <div className="sh-picker-head">
        <span className="sh-k">{picker.stock}</span>
        <div className="sh-filters" role="group" aria-label={picker.filterAria}>
          {(["all", "stock", "allDay"] as const).filter((f) => f === "all" || counts[f] > 0).map((f) => (
            <button key={f} type="button" className="sh-filter" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {picker.filter[f]} <span className="sh-filter-n">{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>
      <ShortAssetPicker
        stocks={shown}
        value={stock.asset}
        marks={marks}
        onChange={(asset) => {
          const next = stocks.find((s) => s.asset === asset)?.windows[0];
          if (next) onSelect(next);
        }}
      />

      <ShortPickSummary stock={stock} marks={marks} />
      <span className="sh-k sh-k--gap">{picker.window}</span>
      <div className="sh-cadences" role="group" aria-label={picker.cadenceAria}>
        {cadences.map((c) => {
          const first = stock.windows.find((w) => w.intervalSec === c);
          const live = stock.windows.some((w) => w.intervalSec === c && isLiveWindow(w, nowMs));
          return (
            <button key={c} type="button" className="sh-cadence" aria-pressed={c === cadence} onClick={() => first && onSelect(first)} data-cursor="hover">
              <span className="sh-cadence-dot" data-live={live ? "" : undefined} aria-hidden />
              {formatCadence(c)}
            </button>
          );
        })}
      </div>
      <div className="sh-windows" role="group" aria-label={picker.window}>
        {windows.map((market) => (
          <WindowRow key={market.marketId} market={market} on={market.marketId === selected?.marketId} onSelect={onSelect} nowMs={nowMs} />
        ))}
      </div>
    </div>
  );
}

function WindowRow({ market, on, onSelect, nowMs }: { market: EventMarket; on: boolean; onSelect: (m: EventMarket) => void; nowMs: number }) {
  const live = isLiveWindow(market, nowMs);
  return (
    <button type="button" aria-pressed={on} onClick={() => onSelect(market)} className={cn("sh-window", on && "sh-window--on")} data-live={live ? "" : undefined} data-cursor="hover">
      <span className="sh-window-c">{formatCadence(market.intervalSec)}</span>
      {live ? <LiveTerms market={market} nowMs={nowMs} /> : <span className="sh-window-t">{SHORT.picker.opens(opensAt(market.tradingStartSec))}</span>}
    </button>
  );
}

/** A live Window prices itself from the top of its own book: the Down ask, what a dollar of the fall costs now. */
function LiveTerms({ market, nowMs }: { market: EventMarket; nowMs: number }) {
  const { picker } = SHORT;
  const { downCents, hydrating } = useTopOfBook(market);
  return (
    <>
      <span className="sh-window-t">
        <Countdown expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} /> {picker.left}
      </span>
      <span className="sh-window-p">
        <span className="sh-window-pk">{picker.costLabel}</span>
        <span className="sh-window-pv numbers">{hydrating ? picker.costPending : downCents === null ? picker.noQuotes : picker.cost(downCents)}</span>
      </span>
    </>
  );
}
