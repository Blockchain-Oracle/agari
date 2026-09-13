"use client";

import type { StrategySubscription } from "@masayume/core/strategies";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { STRATEGIES } from "./copy";
import type { StrategyWire } from "./protocol";
import { StrategyCard, tierOf } from "./StrategyCard";
import "./strategies.css";

const TABS = ["all", "settled", "memwal", "copied", "safest", "new"] as const;
type TabKey = (typeof TABS)[number];

function filterSort(list: StrategyWire[], tab: TabKey): StrategyWire[] {
  let out = [...list];
  if (tab === "settled") out = out.filter((c) => tierOf(c).key === "settled");
  else if (tab === "new") out = out.filter((c) => tierOf(c).key === "new");
  else if (tab === "memwal") out = out.filter((c) => Boolean(c.playbook));
  const settledFirst = (a: StrategyWire, b: StrategyWire) => (tierOf(b).key === "settled" ? 1 : 0) - (tierOf(a).key === "settled" ? 1 : 0);
  if (tab === "copied") out.sort((a, b) => b.subscribers - a.subscribers || b.record.fills - a.record.fills);
  else if (tab === "safest") out.sort((a, b) => Number(BigInt(a.envelope.maxStakePerTradeBase) - BigInt(b.envelope.maxStakePerTradeBase)));
  else out.sort((a, b) => settledFirst(a, b) || b.record.fills - a.record.fills || b.subscribers - a.subscribers);
  return out;
}

interface StrategyGridProps {
  strategies: StrategyWire[];
  subscriptionOf: (id: string) => StrategySubscription | null;
  decimals: number;
  symbol: string;
  asset: string;
  loadError: boolean;
  onOpen: (card: StrategyWire) => void;
}

/** Published strategies, shown by default; filters hide their zero counts. */
export function StrategyGrid({ strategies, subscriptionOf, decimals, symbol, asset, loadError, onOpen }: StrategyGridProps) {
  const [show, setShow] = useState(true);
  const [tab, setTab] = useState<TabKey>("all");
  const visible = useMemo(() => filterSort(strategies, tab), [strategies, tab]);
  const count = (k: TabKey) => filterSort(strategies, k).length;
  return (
    <>
      <div className="mt-12 flex items-center justify-between gap-4 border-t border-hairline pt-6">
        <div>
          <h2 className="strat-h2">{STRATEGIES.archive.title}</h2>
          <p className="strat-meta mt-1 text-ink/35">{STRATEGIES.archive.editions(strategies.length)}</p>
        </div>
        <button type="button" onClick={() => setShow((v) => !v)} aria-expanded={show} className="strat-toggle">
          {show ? STRATEGIES.archive.hide : STRATEGIES.archive.show(strategies.length)}
        </button>
      </div>

      {show && (
        <div className="sticky top-16 z-20 mt-5 -mx-4 mb-7 border-b border-hairline bg-bg/85 px-4 py-3 backdrop-blur-md">
          <div className="no-scrollbar flex items-center gap-5 overflow-x-auto">
            {TABS.filter((k) => k === "all" || count(k) > 0).map((k) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={cn("strat-tab", tab === k && "strat-tab--on")}>
                {STRATEGIES.tabs[k]}
                <span className={cn("ml-1.5 tabular-nums", tab === k ? "text-ink/30" : "text-ink/20")}>{count(k)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {show &&
        (visible.length === 0 ? (
          <div className="strat-empty">
            <div className="strat-rail-title mb-4 text-ink/40">
              <span className="text-vermilion">⊙</span> {STRATEGIES.archive.ledger}
            </div>
            <h2 className="strat-h2 mb-2">{strategies.length === 0 ? STRATEGIES.archive.noneTitle : STRATEGIES.archive.noTab(STRATEGIES.tabs[tab])}</h2>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-ink/40">{loadError ? STRATEGIES.archive.unreachable : strategies.length === 0 ? STRATEGIES.archive.noneBody : STRATEGIES.archive.noMatch}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3">
            {visible.map((card) => (
              <StrategyCard key={card.strategyId} card={card} sub={subscriptionOf(card.strategyId)} decimals={decimals} symbol={symbol} asset={asset} onOpen={() => onOpen(card)} />
            ))}
          </div>
        ))}
    </>
  );
}
