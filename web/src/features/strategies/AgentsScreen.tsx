"use client";

import { rankAgents, type StrategyRecord } from "@masayume/core/strategies";
import { addressUrl } from "@masayume/core/urls";
import Link from "next/link";
import { useMemo } from "react";
import { CapabilityPending } from "@/components/shell";
import { ReadingBoundary } from "@/components/states";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { cn } from "@/lib/utils";
import { AGENTS, STRATEGIES } from "./copy";
import { money } from "./format";
import { ago, shortAddress } from "./names";
import { AgentPortrait } from "./AgentPortrait";
import { strategyIdentity } from "./identity";
import type { StrategiesPayload } from "./protocol";
import { useRefreshStrategies, useStrategies } from "./useStrategies";
import "./strategies.css";
import "./builder.css";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="agents-stat">
      <div className="strat-meta mb-2 tracking-[0.2em] text-ink-muted">{label}</div>
      <div className="agents-stat-value">{value}</div>
      {sub && <div className="strat-mono-11 mt-1 text-ink-disabled">{sub}</div>}
    </div>
  );
}

function toRecord(w: StrategiesPayload["strategies"][number]): StrategyRecord {
  return {
    strategyId: BigInt(w.strategyId),
    creator: w.creator as `0x${string}`,
    runner: w.runner as `0x${string}`,
    specHash: w.specHash as `0x${string}`,
    metadata: w.metadata,
    envelope: { maxStakePerTradeBase: BigInt(w.envelope.maxStakePerTradeBase), maxDailySpendBase: BigInt(w.envelope.maxDailySpendBase), maxOpenPositions: w.envelope.maxOpenPositions, maxPriceRaw: BigInt(w.envelope.maxPriceRaw) },
    feeBase: BigInt(w.feeBase),
    active: w.active,
    createdAtSec: w.createdAtSec,
    subscribers: w.subscribers,
    revision: w.revision,
  };
}

/** `/agents` — ported from `reference/yosuku/app/agents/page.tsx`: the desk ranked on entrusted capital and executed copy-trades, never win rate. */
export function AgentsScreen() {
  const reading = useStrategies();
  const refresh = useRefreshStrategies();
  const nowMs = useChainNowMs();
  return (
    <div className="container pt-7 pb-12">
      <div className="strat-mono-11 mb-7 flex items-center gap-3 tracking-[0.18em] uppercase text-ink-muted">
        <Link href="/" className="transition-colors hover:text-ink">
          {AGENTS.crumb.root}
        </Link>
        <span className="text-ink-disabled">/</span>
        <span className="text-ink">{AGENTS.crumb.here}</span>
      </div>
      <h1 className="agents-h1">{AGENTS.headline}</h1>
      <p className="mb-10 max-w-2xl text-sm leading-relaxed text-ink-secondary">{AGENTS.intro}</p>
      <nav className="agent-entry" aria-label="Agent actions"><Link className="desk-pill" href="/strategies">Create an agent →</Link><Link className="desk-pill" href="/strategies?view=copy">Copy a strategy →</Link><Link className="desk-pill" href="/strategies?view=yours">Your strategies →</Link></nav>
      <ReadingBoundary reading={reading} shape="plate" retry={refresh}>
        {(payload) => (payload.deployed ? <Board payload={payload} nowMs={nowMs} /> : <CapabilityPending eyebrow={AGENTS.title} title={AGENTS.title} dependency={AGENTS.notDeployed.dependency}><p>{STRATEGIES.notDeployed.body}</p></CapabilityPending>)}
      </ReadingBoundary>
    </div>
  );
}

function Board({ payload, nowMs }: { payload: StrategiesPayload; nowMs: number }) {
  const { strategies, decimals, symbol } = payload;
  const rows = useMemo(() => {
    const byId = new Map(strategies.map((s) => [s.strategyId, s]));
    return rankAgents(
      strategies.map(toRecord),
      (id) => {
        const w = byId.get(id.toString());
        if (!w) return null;
        return { ...w.record, netBase: BigInt(w.record.netBase), stakedBase: BigInt(w.record.stakedBase), curve: w.record.curve.map((p) => ({ atSec: p.atSec, cumBase: BigInt(p.cumBase) })) };
      },
    );
  }, [strategies]);
  const totalVolume = rows.reduce((s, r) => s + r.capitalEntrustedBase, 0n);
  const totalSubscribers = strategies.reduce((s, c) => s + c.subscribers, 0);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={AGENTS.stats.agents} value={String(rows.length)} />
        <Stat label={AGENTS.stats.strategies} value={String(strategies.length)} />
        <Stat label={AGENTS.stats.subscribers} value={String(totalSubscribers)} sub={AGENTS.stats.subscribersSub} />
        <Stat label={AGENTS.stats.volume} value={money(totalVolume, decimals)} sub={AGENTS.stats.volumeSub} />
      </div>

      <section>
        <div className="mb-4 flex items-center gap-3 border-b border-hairline pb-2">
          <span className="strat-mono-11 text-vermilion">{AGENTS.desk.index}</span>
          <h2 className="strat-h2">{AGENTS.desk.title}</h2>
          <span className="strat-meta ml-auto text-ink-muted">{AGENTS.desk.meta(rows.length)}</span>
        </div>
        {rows.length === 0 ? (
          <div className="agents-panel p-16 text-center">
            <h2 className="strat-h2 mb-2">{AGENTS.empty.title}</h2>
            <p className="mx-auto max-w-sm text-sm text-ink-muted">{AGENTS.empty.body}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row, i) => {
              const rank = i + 1;
              const top = rank === 1;
              const editions = strategies.filter((card) => card.runner.toLowerCase() === row.runner.toLowerCase());
              const identity = editions.length === 1 ? strategyIdentity(editions[0]!) : { name: `Runner ${shortAddress(row.runner)}`, seed: `runner:${row.runner}` };
              return (
                <div key={row.runner} className={cn("agents-row", top && "agents-row--top")}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <div className="agents-rank">{String(rank).padStart(2, "0")}</div>
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <AgentPortrait seed={identity.seed} name={identity.name} size="row" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <a href={addressUrl(row.runner)} target="_blank" rel="noreferrer" className="strat-mono-12 truncate text-ink transition-colors hover:text-vermilion">
                            {identity.name}
                          </a>
                          {top && <span className="agents-top-badge">{AGENTS.desk.top}</span>}
                        </div>
                        <div className="strat-mono-11 mt-1 truncate text-ink-disabled">
                          {AGENTS.desk.strategies(row.strategies)} · {AGENTS.desk.subscribers(row.subscribers)}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3">{editions.map((card) => <Link key={card.strategyId} href={`/strategies?view=copy&strategy=${card.strategyId}`} className="strat-mono-11 text-vermilion">{strategyIdentity(card).name} →</Link>)}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 md:flex md:shrink-0 md:items-center md:gap-8">
                      <div className="md:text-right">
                        <div className="agents-label">{AGENTS.desk.entrusted}</div>
                        <div className="agents-figure agents-figure--v">
                          {money(row.capitalEntrustedBase, decimals)}
                          <span className="strat-mono-11 ml-1 text-ink-muted">{symbol}</span>
                        </div>
                      </div>
                      <div className="md:text-right">
                        <div className="agents-label">{AGENTS.desk.copyTrades}</div>
                        <div className="agents-figure text-ink">{row.copyTrades}</div>
                      </div>
                      <div className="md:text-right">
                        <div className="agents-label">{AGENTS.desk.maxPerTrade}</div>
                        <div className="agents-figure text-ink">{money(row.maxStakePerTradeBase, decimals)}</div>
                      </div>
                      <div className="md:text-right">
                        <div className="agents-label">{AGENTS.desk.lastActive}</div>
                        <div className="strat-mono-12 text-ink-secondary">{ago(row.lastActiveSec * 1000, nowMs)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-3 border-b border-hairline pb-2">
          <span className="strat-mono-11 text-vermilion">{AGENTS.how.index}</span>
          <h2 className="strat-h2">{AGENTS.how.title}</h2>
        </div>
        <div className="agents-panel">
          <ul className="space-y-3 text-sm leading-relaxed text-ink-secondary">
            {AGENTS.how.rules.map((rule, i) => (
              <li key={rule.join("")} className="flex gap-3">
                <span className="strat-mono-11 mt-0.5 shrink-0 text-vermilion">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  {rule.map((part, j) => (j % 2 === 1 ? <span key={part} className="text-ink">{part}</span> : <span key={`${part}${j}`}>{part}</span>))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
