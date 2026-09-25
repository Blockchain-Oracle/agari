"use client";

import { formatCadence } from "@agari/core/copy";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { STRATEGIES } from "./copy";
import { DecisionDetail } from "./DecisionDetail";
import { DECISION } from "./decision-copy";
import { ago } from "./names";
import type { DecisionWire, StrategyWire } from "./protocol";
import "./strategies.css";
import "./decision.css";

const M = STRATEGIES.drawer.memory;
const H = STRATEGIES.drawer.agentHow;

function MemoryRow({ d, nowMs, onOpen }: { d: DecisionWire; nowMs: number; onOpen: () => void }) {
  const call = d.verdictSide === "none" ? M.noAnswer : M.call(d.verdictSide, d.confidence);
  const ruling = d.gate === "trade" && d.side ? M.sent(d.side, d.filled) : M.held;
  return (
    <button type="button" className="strat-memory-row strat-memory-open" onClick={onOpen} aria-label={`${DECISION.open}: ${ago(d.decidedAtMs, nowMs)}, ${call}`}>
      <span className="strat-mono-10 flex items-baseline justify-between gap-2 text-ink/40">
        <span className="truncate">
          {ago(d.decidedAtMs, nowMs)}
          {d.intervalSec !== null && ` · ${d.asset ?? "Window"} ${formatCadence(d.intervalSec)}`}
        </span>
        <span className="flex shrink-0 items-baseline gap-2">
          {d.outcome && <span className={cn("uppercase tracking-[0.12em]", d.outcome === "won" ? "text-vermilion" : d.outcome === "lost" ? "text-ink/60" : "text-ink/30")}>{M.outcome[d.outcome]}</span>}
          <span className="strat-memory-more" aria-hidden>→</span>
        </span>
      </span>
      <span className="strat-mono-11 mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className={cn(d.gate === "failed" ? "text-ink/50" : "text-ink")}>{call}</span>
        <span className={cn(d.gate === "trade" ? "text-vermilion" : "text-ink/50")}>→ {ruling}</span>
      </span>
      <span className="mt-1 line-clamp-2 block text-xs leading-snug text-ink-secondary">“{d.why}”</span>
      {d.gate !== "trade" && <span className="strat-mono-10 mt-0.5 block text-ink/35">{d.gateReason}</span>}
    </button>
  );
}

interface AgentMemoryProps {
  agent: NonNullable<StrategyWire["agent"]>;
  agentName: string;
  storeConnected: boolean;
  decimals: number;
  symbol: string;
  nowMs: number;
}

/**
 * The drawer's "◈ agent memory": the model by name, then the last Windows it read with the gate's ruling and how
 * each settled. Each row opens that decision in full.
 */
export function AgentMemory({ agent, agentName, storeConnected, decimals, symbol, nowMs }: AgentMemoryProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = agent.decisions.find((d) => d.marketId === openId) ?? null;
  return (
    <div className="mb-4 border border-vermilion/30 px-4 py-3">
      <p className="strat-meta mb-1.5 tracking-[0.18em] text-vermilion">{M.eyebrow}</p>
      <p className="strat-drawer-body">{M.body}</p>
      <p className="strat-mono-10 mt-1.5 truncate text-ink/40">{agent.model ? H.model(agent.model) : H.noModel}</p>
      {agent.decisions.length === 0 ? (
        <p className="strat-mono-11 mt-2 text-ink-muted">{storeConnected ? M.empty : M.storeOff}</p>
      ) : (
        <div className="mt-2">
          {agent.decisions.map((d) => (
            <MemoryRow key={d.marketId} d={d} nowMs={nowMs} onOpen={() => setOpenId(d.marketId)} />
          ))}
        </div>
      )}
      <DecisionDetail decision={open} agentName={agentName} decimals={decimals} symbol={symbol} nowMs={nowMs} onClose={() => setOpenId(null)} />
    </div>
  );
}
