"use client";

import type { EquityPoint } from "@masayume/core/projection";
import { parseStrategyMetadata, type StrategySubscription } from "@masayume/core/strategies";
import { EquitySparkline } from "@/features/markets/history";
import { cn } from "@/lib/utils";
import { AgentPortrait } from "./AgentPortrait";
import { STRATEGIES } from "./copy";
import { money } from "./format";
import { strategyIdentity } from "./identity";
import type { StrategyWire } from "./protocol";
import "./strategies.css";

export type Tier = { key: "new" | "active" | "settled"; label: string };

/** Honest tiers: "Settled" means closed, on-chain P&L (win OR loss) — never profit; a copied agent is not "new". */
export function tierOf(c: StrategyWire): Tier {
  if (c.record.settled > 0) return { key: "settled", label: STRATEGIES.tiers.settled(c.record.settled) };
  if (c.record.fills >= 1) return { key: "active", label: STRATEGIES.tiers.active(c.record.fills) };
  if (c.subscribers > 0) return { key: "new", label: STRATEGIES.tiers.copying(c.subscribers) };
  return { key: "new", label: STRATEGIES.tiers.fresh };
}

interface StrategyCardProps {
  card: StrategyWire;
  sub: StrategySubscription | null;
  decimals: number;
  symbol: string;
  asset: string;
  onOpen: () => void;
}

/** One archive card (reference grid item): who, the one bold move, status, a quiet spec line, a borderless CTA. */
export function StrategyCard({ card, sub, decimals, symbol, asset, onOpen }: StrategyCardProps) {
  const { name, seed } = strategyIdentity(card);
  const settled = card.record.settled > 0;
  const net = BigInt(card.record.netBase);
  const points: EquityPoint[] = [{ atMs: null, cumulativeBase: 0n }, ...card.record.curve.map((p) => ({ atMs: p.atSec * 1000, cumulativeBase: BigInt(p.cumBase) }))];
  const fee = BigInt(card.feeBase);
  const copiers = card.subscribers > 0 ? ` · ${card.subscribers} copiers` : "";
  // The instinct slot is one mono line; the agent's full sentence (`describeSpec`) lives in the drawer.
  const spec = parseStrategyMetadata(card.metadata)?.spec ?? null;
  const instinct = spec?.preset === "agent" ? STRATEGIES.archive.agentInstinct(asset, spec.posture) : STRATEGIES.archive.instinct(asset);
  const memory = Boolean(card.agent && card.agent.decisions.length > 0);
  return (
    <div
      id={`strategy-${card.strategyId}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="strat-card group flex flex-col"
    >
      <div className="flex items-start gap-3.5">
        <AgentPortrait seed={seed} name={name} />
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="strat-card-name text-ink">{name}</h3>
          <p className="strat-card-instinct">{instinct}</p>
        </div>
        <span className="strat-card-cap">
          {money(BigInt(card.envelope.maxStakePerTradeBase), decimals)} <span className="text-ink/40">{STRATEGIES.archive.max}</span>
        </span>
      </div>

      <div className="strat-card-move">
        {settled ? (
          <>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className={cn("strat-card-net", net >= 0n ? "strat-card-net--gain" : "strat-card-net--loss")}>
                {net >= 0n ? "+" : "−"}
                {money(net < 0n ? -net : net, decimals)}
              </span>
              <span className="strat-meta text-ink/40">
                {symbol} {STRATEGIES.archive.netMeta(card.record.settled)}
              </span>
            </div>
            {card.record.curve.length >= 2 && (
              <div className="-mx-1 mt-3 text-ink">
                <EquitySparkline points={points} decimals={decimals} className="w-full" />
              </div>
            )}
          </>
        ) : (
          <div className="strat-mono-11 pt-2.5 uppercase tracking-[0.14em] text-ink/40">{tierOf(card).label}</div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="strat-card-tag strat-card-tag--quiet">
          <span className="strat-card-tag-dot" /> {card.active ? "Published" : "Inactive"}
        </span>
        {memory && <span className="strat-card-tag strat-mem">{STRATEGIES.archive.memory}</span>}
        {card.playbook && <span className="strat-card-tag strat-mem">{STRATEGIES.archive.playbook}</span>}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 pt-6">
        <span className="strat-mono-10 truncate text-ink/40">{STRATEGIES.archive.foot(money(BigInt(card.envelope.maxStakePerTradeBase), decimals), fee === 0n ? STRATEGIES.archive.free : `${money(fee, decimals)} fee`, copiers)}</span>
        <span className={cn("strat-mono-11 inline-flex shrink-0 items-center gap-1.5 uppercase tracking-[0.12em] transition-colors", sub ? "text-vermilion" : "text-ink/55 group-hover:text-ink")}>
          {sub ? (
            <>
              {sub.live && <span className="strat-live-dot" />} Manage copy
            </>
          ) : (
            STRATEGIES.archive.copy
          )}
          <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
        </span>
      </div>
    </div>
  );
}
