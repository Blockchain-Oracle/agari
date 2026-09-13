"use client";

import { formatCadence } from "@masayume/core/copy";
import { cn } from "@/lib/utils";
import { STRATEGIES } from "./copy";
import { ago } from "./names";
import type { DecisionWire, StrategyWire } from "./protocol";
import "./strategies.css";

const M = STRATEGIES.drawer.memory;
const H = STRATEGIES.drawer.agentHow;

function MemoryRow({ d, asset, nowMs }: { d: DecisionWire; asset: string; nowMs: number }) {
  const call = d.verdictSide === "none" ? M.noAnswer : M.call(d.verdictSide, d.confidence);
  const ruling = d.gate === "trade" && d.side ? M.sent(d.side, d.filled) : M.held;
  return (
    <div className="strat-memory-row">
      <div className="strat-mono-10 flex items-baseline justify-between gap-2 text-ink/40">
        <span className="truncate">
          {ago(d.decidedAtMs, nowMs)}
          {d.intervalSec !== null && ` · ${d.asset ?? "Window"} ${formatCadence(d.intervalSec)}`}
        </span>
        {d.outcome && <span className={cn("shrink-0 uppercase tracking-[0.12em]", d.outcome === "won" ? "text-vermilion" : d.outcome === "lost" ? "text-ink/60" : "text-ink/30")}>{M.outcome[d.outcome]}</span>}
      </div>
      <div className="strat-mono-11 mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className={cn(d.gate === "failed" ? "text-ink/50" : "text-ink")}>{call}</span>
        <span className={cn(d.gate === "trade" ? "text-vermilion" : "text-ink/50")}>→ {ruling}</span>
      </div>
      <p className="mt-1 text-xs leading-snug text-ink-secondary">“{d.why}”</p>
      {d.gate !== "trade" && <p className="strat-mono-10 mt-0.5 text-ink/35">{d.gateReason}</p>}
    </div>
  );
}

interface AgentMemoryProps {
  agent: NonNullable<StrategyWire["agent"]>;
  storeConnected: boolean;
  asset: string;
  nowMs: number;
}

/** The drawer's "◈ agent memory": the model by name, then the last Windows it read with the gate's ruling and how each settled. */
export function AgentMemory({ agent, storeConnected, asset, nowMs }: AgentMemoryProps) {
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
            <MemoryRow key={d.marketId} d={d} asset={asset} nowMs={nowMs} />
          ))}
        </div>
      )}
    </div>
  );
}
