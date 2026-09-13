"use client";

import { txUrl } from "@masayume/core/urls";
import { useMemo } from "react";
import { AgentPortrait } from "./AgentPortrait";
import { STRATEGIES } from "./copy";
import { money } from "./format";
import { ago, shortAddress } from "./names";
import { strategyIdentity } from "./identity";
import type { FillWire, StrategyWire } from "./protocol";
import "./strategies.css";

const RECENT_LIMIT = 8;

interface RecentCopyTradesProps {
  fills: FillWire[];
  strategies: StrategyWire[];
  storeConnected: boolean;
  decimals: number;
  symbol: string;
  nowMs: number;
}

/** Recent copy-trades collapsed by copier+strategy so one person's repeats read as "copied ×N · total". */
export function RecentCopyTrades({ fills, strategies, storeConnected, decimals, symbol, nowMs }: RecentCopyTradesProps) {
  const strategyOf = useMemo(() => new Map(strategies.map((s) => [s.strategyId, s])), [strategies]);
  const grouped = useMemo(() => {
    const g = new Map<string, { strategyId: string; owner: string; count: number; totalBase: bigint; atSec: number; txHash: string }>();
    for (const f of fills) {
      const key = `${f.strategyId}::${f.owner}`;
      const cur = g.get(key);
      if (!cur) g.set(key, { strategyId: f.strategyId, owner: f.owner, count: 1, totalBase: BigInt(f.cashDeltaBase), atSec: f.atSec, txHash: f.txHash });
      else {
        cur.count += 1;
        cur.totalBase += BigInt(f.cashDeltaBase);
        if (f.atSec > cur.atSec) {
          cur.atSec = f.atSec;
          cur.txHash = f.txHash;
        }
      }
    }
    return [...g.values()].sort((a, b) => b.atSec - a.atSec);
  }, [fills]);

  return (
    <section className="mt-14">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="strat-rail-title text-ink/40">{STRATEGIES.recent.title}</h2>
        <div className="h-px flex-1 bg-ink/10" />
        <span className="strat-mono-11 tabular-nums text-ink/30">{fills.length}</span>
      </div>
      <div className="strat-rows">
        {!storeConnected ? (
          <div className="strat-rows-empty">{STRATEGIES.recent.storeOff}</div>
        ) : grouped.length === 0 ? (
          <div className="strat-rows-empty">{STRATEGIES.recent.empty}</div>
        ) : (
          grouped.slice(0, RECENT_LIMIT).map((t) => {
            const { name, seed } = strategyIdentity(strategyOf.get(t.strategyId) ?? { strategyId: t.strategyId, runner: "", metadata: "" });
            return (
              <a key={`${t.strategyId}:${t.owner}`} href={txUrl(t.txHash as `0x${string}`)} target="_blank" rel="noreferrer" className="strat-row block">
                <AgentPortrait seed={seed} name={name} size="small" />
                <span className="strat-row-name text-ink">{name}</span>
                <span className="strat-mono-12 hidden text-ink/40 sm:inline">{shortAddress(t.owner)}</span>
                {t.count > 1 && <span className="strat-mono-10 hidden shrink-0 tabular-nums text-ink/35 sm:inline">{STRATEGIES.recent.copied(t.count)}</span>}
                <span className="flex-1" />
                <span className="strat-mono-12 shrink-0 whitespace-nowrap tabular-nums text-ink/70">{money(t.totalBase, decimals, symbol)}</span>
                <span className="strat-mono-11 w-14 shrink-0 text-right text-ink/30">{ago(t.atSec * 1000, nowMs)}</span>
                <span className="strat-mono-11 w-4 shrink-0 text-right text-vermilion">↗</span>
              </a>
            );
          })
        )}
      </div>
    </section>
  );
}
