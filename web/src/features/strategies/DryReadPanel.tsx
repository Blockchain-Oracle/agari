"use client";

import { formatCadence } from "@masayume/core/copy";
import { formatClock } from "@masayume/core/units";
import { cn } from "@/lib/utils";
import { STRATEGIES } from "./copy";
import type { AgentPreviewResponse } from "./protocol";
import type { DryRead } from "./useDryRead";
import "./strategies.css";

const DRY = STRATEGIES.studio.agent.dry;

function cents(value: number | null): string {
  return value === null ? DRY.unquoted : `${value}¢`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="strat-micro mb-1 text-ink/40">{label}</div>
      <div className="strat-mono-12 truncate tabular-nums text-ink">{value}</div>
    </div>
  );
}

/** What one dry read saw and said: the Window, the print and the books, the call, the gate's ruling, the model by name. */
function Result({ result }: { result: AgentPreviewResponse }) {
  const { market, read, verdict, failure, gate, model } = result;
  return (
    <>
      <div className="strat-mono-11 mt-2 text-ink">
        {DRY.window(market.asset, formatCadence(market.intervalSec))} <span className="text-ink/40">· {DRY.elapsed(formatClock(market.elapsedSec), formatClock(market.leftSec))}</span>
        {!market.inSlot && <span className="text-ink/40"> · {DRY.outsideSlot}</span>}
      </div>
      <div className="strat-dry-grid">
        <Stat label={DRY.print} value={read.openingText} />
        <Stat label="EMA" value={DRY.move(read.moveBps)} />
        <Stat label={DRY.books} value={`${cents(read.upCents)} · ${cents(read.downCents)}`} />
      </div>
      <div className="mt-3 border-t border-hairline pt-3">
        <div className="strat-micro mb-1 text-ink/40">{DRY.said}</div>
        {verdict ? (
          <>
            <div className="strat-mono-12 text-ink">{DRY.call(verdict.side, verdict.confidence)}</div>
            <p className="mt-1 text-xs leading-snug text-ink-secondary">“{verdict.why}”</p>
          </>
        ) : (
          <div className="strat-mono-11 text-ink/60">{DRY.noAnswer(failure ?? "")}</div>
        )}
      </div>
      <div className="mt-3 border-t border-hairline pt-3">
        <div className="strat-micro mb-1 text-ink/40">{DRY.gate}</div>
        <div className={cn("strat-mono-12", gate.side ? "text-vermilion" : "text-ink/70")}>{gate.side ? DRY.gateTrade(gate.side) : DRY.gateHold}</div>
        <p className="mt-1 text-xs leading-snug text-ink-secondary">{gate.reason}</p>
      </div>
      <div className="strat-mono-10 mt-3 truncate text-ink/40">{DRY.model(model)}</div>
    </>
  );
}

export function DryReadPanel({ state }: { state: DryRead }) {
  if (state.status === "idle") return null;
  return (
    <div className="strat-dry" aria-live="polite">
      <div className="flex items-baseline justify-between gap-2">
        <span className="strat-micro text-vermilion">{DRY.eyebrow}</span>
        {state.status === "reading" && <span className="strat-mono-10 text-ink/40">{DRY.reading}</span>}
      </div>
      {state.status === "error" && <p className="strat-mono-11 mt-2 leading-relaxed text-ink/70">{state.error}</p>}
      {state.status === "ok" && <Result result={state.result} />}
    </div>
  );
}
