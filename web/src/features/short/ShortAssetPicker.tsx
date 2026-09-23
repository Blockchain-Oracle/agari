"use client";

import type { TickerSymbol } from "@agari/core/market";
import { useRef, type KeyboardEvent } from "react";
import { Sparkline } from "@/components/ui/desk-kit";
import type { DeskMarks } from "@/features/desk/useDeskMarks";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { useMarketSession } from "@/features/markets/session";
import { SHORT } from "./copy";
import { lineOf, nameOfAsset, PriceLine } from "./ShortAssetCard";
import { opensAt, type ShortStock } from "./useShortWindows";

/**
 * The names a short can be opened on, compact (S24): a dense grid of small cards on a desk, a snap row of chips on a
 * phone, and — while some names trade and others wait for the bell — two labelled groups with the tradable ones first.
 * One radio group across both groups: arrow keys move the choice, Tab leaves it. The chosen name's full detail shows
 * once, in `ShortPickSummary`, rather than on every card.
 */
interface Group {
  key: string;
  label: string | null;
  stocks: ShortStock[];
}

function groupsOf(stocks: ShortStock[], sessionLabel: string | null): Group[] {
  const live = stocks.filter((s) => s.liveCount > 0);
  const later = stocks.filter((s) => s.liveCount === 0);
  if (live.length === 0 || later.length === 0) return [{ key: "all", label: null, stocks }];
  // Named for what is in it, and timed by the session, not by a Window's start: "Stocks · Opens Wed 09:30 ET" only when
  // every waiting name is a stock (a 24/7 name between two Windows at the top of the hour waits too, and the bell is
  // not its opening).
  const allStocks = later.every((s) => s.kind === "stock");
  return [
    { key: "live", label: SHORT.picker.groupLive, stocks: live },
    { key: "later", label: allStocks && sessionLabel ? SHORT.picker.groupLater(sessionLabel) : SHORT.picker.groupLaterBare, stocks: later },
  ];
}

function StatusDot({ stock }: { stock: ShortStock }) {
  return <span className="sh-chip-dot" data-live={stock.liveCount > 0 ? "" : undefined} aria-hidden />;
}

export function ShortAssetPicker({ stocks, value, onChange, marks }: { stocks: ShortStock[]; value: string; onChange: (asset: TickerSymbol) => void; marks: DeskMarks | null }) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const session = useMarketSession();
  const groups = groupsOf(stocks, session && !session.open ? session.label : null);
  const order = groups.flatMap((g) => g.stocks.map((s) => s.asset));

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, asset: TickerSymbol) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    const edge = e.key === "Home" ? 0 : e.key === "End" ? order.length - 1 : null;
    if (step === 0 && edge === null) return;
    e.preventDefault();
    const at = order.indexOf(asset);
    const next = order[edge ?? (at + step + order.length) % order.length];
    if (!next) return;
    onChange(next);
    const el = refs.current.get(next);
    el?.focus();
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  return (
    <div className="sh-chips" role="radiogroup" aria-label={SHORT.picker.stock}>
      {groups.map((g) => (
        <div key={g.key} className="sh-chip-group">
          {g.label && <span className="sh-chip-group-label">{g.label}</span>}
          <div className="sh-chip-row">
            {g.stocks.map((s) => {
              const on = s.asset === value;
              const line = lineOf(s, marks);
              return (
                <button
                  key={s.asset}
                  ref={(el) => {
                    if (el) refs.current.set(s.asset, el);
                    else refs.current.delete(s.asset);
                  }}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  className="sh-chip"
                  onClick={() => onChange(s.asset)}
                  onKeyDown={(e) => onKey(e, s.asset)}
                  data-cursor="hover"
                >
                  <span className="sh-chip-top">
                    <AssetDisc asset={s.asset} className="sh-chip-mark" />
                    <span className="sh-chip-names">
                      <span className="sh-chip-name">{nameOfAsset(s.asset)}</span>
                      <span className="sh-chip-tag">${s.asset}</span>
                    </span>
                  </span>
                  <span className="sh-chip-bottom">
                    <StatusDot stock={s} />
                    <PriceLine asset={s.asset} />
                    {line.length > 1 && <Sparkline values={line} width={44} height={16} className="sh-chip-spark" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** The chosen name in full, once: mark, name, kind, whether it trades now or when it opens, live price and week. */
export function ShortPickSummary({ stock, marks }: { stock: ShortStock; marks: DeskMarks | null }) {
  const { picker } = SHORT;
  const live = stock.liveCount > 0;
  const next = stock.windows[0];
  const line = lineOf(stock, marks);
  return (
    <div className="sh-pick" aria-live="polite">
      <AssetDisc asset={stock.asset} className="sh-pick-mark" />
      <div className="sh-pick-text">
        <span className="sh-pick-name">{nameOfAsset(stock.asset)}</span>
        <span className="sh-asset-sub">
          <span className="sh-asset-tag">${stock.asset}</span>
          <span className="sh-asset-kind" data-kind={stock.kind}>{picker.kind[stock.kind]}</span>
          <span className="sh-asset-when" data-live={live ? "" : undefined}>
            <span className="sh-asset-when-dot" aria-hidden />
            {live ? picker.liveNow : next ? picker.opens(opensAt(next.tradingStartSec)) : picker.closed}
          </span>
        </span>
      </div>
      <div className="sh-pick-right">
        <PriceLine asset={stock.asset} />
        {line.length > 1 && <Sparkline values={line} width={88} height={26} className="sh-pick-spark" />}
      </div>
    </div>
  );
}
