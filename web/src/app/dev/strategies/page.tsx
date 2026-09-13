"use client";

import { useState } from "react";
import { SectionHeader } from "@/components/chrome";
import { CapabilityPending } from "@/components/shell";
import { RecordCard, StrategyCard, STRATEGIES } from "@/features/strategies";
import { AgentMemory } from "@/features/strategies/AgentMemory";
import { RecentCopyTrades } from "@/features/strategies/RecentCopyTrades";
import { DeskPulse } from "@/features/strategies/DeskStates";
import { StudioAgentFields } from "@/features/strategies/StudioAgentFields";
import type { StudioDraft } from "@/features/strategies/studio-draft";
import { cn } from "@/lib/utils";
import { AGENT, DECIMALS, FIXTURE_NOW_MS, FILLS, HOUSE, PAYLOADS, SYMBOL, YOUNG, FRESH } from "./fixtures";

const DEV = {
  title: "Strategies",
  intro: "The desk's record card, the archive cards in each tier, the runner pulse in every health state, recent copy-trades with and without a store, and the honest not-deployed state — no registry, no runner.",
  record: "Track record — a public curve with drawdown drawn",
  cards: "Archive cards — settled, an AI agent with memory, active, new",
  pulse: "Runner pulse — alive, dead, never started, store offline",
  recent: "Recent copy-trades — grouped rows, then the store-off state",
  states: "Payload states — live, empty registry, no store, not deployed",
  studio: "Studio — the AI agent's brief, posture, Windows and dry read",
  memory: "Drawer — agent memory, with and without a store",
} as const;

const DRAFT: StudioDraft = { preset: "agent", lookback: 6, thresholdPct: "0.2", persona: "", posture: "balanced", cadences: [900, 3600], hosting: "house", agent: "", name: "", portraitSeed: "fixture-agent", maxPerTrade: "5", maxDaily: "50", subFee: "0", playbook: "" };

const PULSES = [
  { live: true, label: STRATEGIES.desk.status.watching("BTC") },
  { live: true, label: STRATEGIES.desk.status.signal("up") },
  { live: false, label: STRATEGIES.desk.status.offline },
  { live: false, label: STRATEGIES.desk.status.neverStarted },
  { live: false, label: STRATEGIES.desk.status.unknown },
  { live: false, label: STRATEGIES.desk.status.stale },
] as const;

export default function DevStrategiesPage() {
  const [state, setState] = useState<keyof typeof PAYLOADS>("live");
  const [draft, setDraft] = useState<StudioDraft>(DRAFT);
  const payload = PAYLOADS[state];
  return (
    <div className="mx-auto flex w-full max-w-(--content-wide) flex-col gap-10 px-gutter py-8">
      <div className="flex flex-col gap-2">
        <SectionHeader index="00" title={DEV.title} />
        <p className="type-body text-ink-secondary">{DEV.intro}</p>
      </div>

      <section className="live-desk flex flex-col gap-4">
        <SectionHeader index="01" title={DEV.record} />
        <div className="desk">
          <div className="desk-body">
            <RecordCard record={HOUSE.record} decimals={DECIMALS} symbol={SYMBOL} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader index="02" title={DEV.cards} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[HOUSE, AGENT, YOUNG, FRESH].map((card) => (
            <StrategyCard key={card.strategyId} card={card} sub={null} decimals={DECIMALS} symbol={SYMBOL} asset="BTC" onOpen={() => undefined} />
          ))}
        </div>
      </section>

      <section className="live-desk flex flex-col gap-4">
        <SectionHeader index="03" title={DEV.pulse} />
        <div className="desk">
          <div className="desk-body flex flex-col gap-3">
            {PULSES.map((p) => (
              <DeskPulse key={p.label} live={p.live} label={p.label} />
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader index="04" title={DEV.recent} />
        <RecentCopyTrades fills={FILLS} strategies={[HOUSE, YOUNG]} storeConnected decimals={DECIMALS} symbol={SYMBOL} nowMs={FIXTURE_NOW_MS} />
        <RecentCopyTrades fills={[]} strategies={[HOUSE]} storeConnected={false} decimals={DECIMALS} symbol={SYMBOL} nowMs={FIXTURE_NOW_MS} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader index="05" title={DEV.studio} />
        <div className="strat-preview">
          <StudioAgentFields form={draft} setForm={(update) => setDraft(update)} asset="BTC" decimals={DECIMALS} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader index="06" title={DEV.memory} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="strat-preview">{AGENT.agent && <AgentMemory agent={AGENT.agent} storeConnected asset="BTC" nowMs={FIXTURE_NOW_MS} />}</div>
          <div className="strat-preview">
            <AgentMemory agent={{ model: null, decisions: [] }} storeConnected={false} asset="BTC" nowMs={FIXTURE_NOW_MS} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader index="07" title={DEV.states} />
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PAYLOADS) as Array<keyof typeof PAYLOADS>).map((k) => (
            <button key={k} type="button" onClick={() => setState(k)} className={cn("rounded-full border border-hairline px-3 py-1 type-caption", state === k ? "text-accent" : "text-ink-secondary")}>
              {k}
            </button>
          ))}
        </div>
        {payload.deployed ? (
          <pre className="type-caption overflow-x-auto rounded-lg border border-hairline bg-surface-1 p-4 text-ink-secondary">
            {JSON.stringify({ deployed: payload.deployed, strategies: payload.strategies.length, fills: payload.fills.length, stores: payload.stores }, null, 2)}
          </pre>
        ) : (
          <CapabilityPending eyebrow={STRATEGIES.notDeployed.eyebrow} title={STRATEGIES.notDeployed.title} dependency={STRATEGIES.notDeployed.dependency}>
            <p>{STRATEGIES.notDeployed.body}</p>
          </CapabilityPending>
        )}
      </section>
    </div>
  );
}
