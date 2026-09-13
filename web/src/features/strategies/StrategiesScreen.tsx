"use client";

import { isOk } from "@masayume/core/schemas";
import { useEffect, useState } from "react";
import { CapabilityPending } from "@/components/shell";
import { ReadingBoundary } from "@/components/states";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { ConnectButton } from "@/features/markets/wallet";
import { CopyDrawer } from "./CopyDrawer";
import { STRATEGIES } from "./copy";
import { CreatorStudio } from "./CreatorStudio";
import { strategyIdentity, STRATEGY_MARKETS } from "./identity";
import { LiveDesk } from "./LiveDesk";
import { MemoryMarket } from "./MemoryMarket";
import type { StrategiesPayload } from "./protocol";
import { RecentCopyTrades } from "./RecentCopyTrades";
import { StrategyGrid } from "./StrategyGrid";
import { StrategyXBar } from "./StrategyXBar";
import { useDesk } from "./useDesk";
import { useDeskWrites } from "./useDeskWrites";
import { useRefreshStrategies, useStrategies } from "./useStrategies";
import "./strategies.css";
import "./builder.css";

type View = "create" | "copy" | "yours";
export function StrategiesScreen({ houseRunner }: { houseRunner: string | null }) {
  const reading = useStrategies();
  const refresh = useRefreshStrategies();
  const writes = useDeskWrites();
  const [view, setView] = useState<View>("create");
  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get("view");
    if (selected === "copy" || selected === "yours") setView(selected);
  }, []);
  const payload = reading && isOk(reading) ? reading.value : null;
  return <div className="container pt-7 pb-12">
    <div className="strat-nameplate"><div><p className="strat-meta mb-3 text-vermilion">AGENTS · SOMNIA SHANNON</p><h1 className="strat-h1">Give your strategy a life.</h1></div><StrategyXBar /></div>
    <p className="mb-7 max-w-2xl text-sm text-ink-secondary">Build an AI agent or a momentum rule, test its thinking, and set the limits before it can trade.</p>
    <nav className="agent-entry" aria-label="Strategy workspace">
      {([["create", "Create"], ["copy", "Copy a strategy"], ["yours", "Your strategies"]] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>)}
    </nav>
    {writes.pending && !writes.busy && <div className="copy-progress mt-5" role="status"><strong>Copy setup needs attention.</strong><p>Strategy #{writes.pending.strategyId} has an unfinished permission or subscription. Your progress is saved on this browser.</p><button className="desk-pill mt-3" onClick={() => setView("yours")}>Continue setup →</button></div>}
    <div hidden={view !== "create"}>
      <CreatorStudio writes={writes} decimals={payload?.decimals ?? 6} symbol={payload?.symbol ?? "tUSDC"} asset={STRATEGY_MARKETS} houseRunner={houseRunner} onPublished={() => setView("yours")} />
    </div>
    {view !== "create" && <ReadingBoundary reading={reading} shape="plate" retry={refresh}>
      {(data) => data.deployed ? <Catalogue payload={data} writes={writes} view={view} onCreate={() => setView("create")} /> : <CapabilityPending eyebrow={STRATEGIES.notDeployed.eyebrow} title={STRATEGIES.notDeployed.title} dependency={STRATEGIES.notDeployed.dependency}><p>{STRATEGIES.notDeployed.body}</p></CapabilityPending>}
    </ReadingBoundary>}
  </div>;
}

function Catalogue({ payload, writes, view, onCreate }: { payload: StrategiesPayload; writes: ReturnType<typeof useDeskWrites>; view: View; onCreate: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const desk = useDesk(payload, writes.address, writes.snapshot, selected);
  const nowMs = useChainNowMs();
  const { strategies, fills, decimals, symbol } = payload;
  const vault = writes.snapshot && isOk(writes.snapshot) ? writes.snapshot.value : null;
  const available = vault?.account.availableBase ?? 0n;
  const own = strategies.filter((s) => s.creator.toLowerCase() === writes.address?.toLowerCase() || desk.subscriptionOf(s.strategyId) || writes.pending?.strategyId === s.strategyId);
  const visible = view === "yours" ? own : strategies;
  const drawer = strategies.find((s) => s.strategyId === drawerId) ?? null;
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("strategy");
    if (requested && strategies.some((card) => card.strategyId === requested)) { setSelected(requested); setDrawerId(requested); }
  }, []);
  return <>
    {view === "yours" && !writes.address ? <div className="strat-empty"><h2 className="strat-h2 mb-3">Your strategies, in one place.</h2><p className="mb-5 text-ink-secondary">Connect the wallet that created or copied them.</p><ConnectButton /></div> : <>
      {view === "yours" && own.length > 0 && <div className="agent-selection mt-6"><label htmlFor="selected-strategy">Manage a strategy</label><select id="selected-strategy" value={selected ?? ""} onChange={(e) => setSelected(e.target.value)}><option value="">Choose a strategy</option>{own.map((card) => <option key={card.strategyId} value={card.strategyId}>{strategyIdentity(card).name} · #{card.strategyId}</option>)}</select></div>}
      {view === "yours" && selected && <LiveDesk payload={payload} desk={desk} nowMs={nowMs} onManage={() => desk.featured && setDrawerId(desk.featured.strategyId)} />}
      {writes.pending && <button type="button" className="desk-btn-primary mt-5" onClick={() => setDrawerId(writes.pending!.strategyId)}>Review unfinished copy of #{writes.pending.strategyId} →</button>}
      {view === "yours" && !desk.readable && <p className="copy-progress">Your subscriptions and permissions have not been verified yet. Connect on Somnia Shannon and retry if this continues.</p>}
      {view === "yours" && desk.readable && own.length === 0 && <div className="strat-empty"><h2 className="strat-h2">No strategies here yet.</h2><p className="my-3 text-ink-secondary">Publish a strategy, or copy one with this wallet.</p><button type="button" className="desk-btn-primary" onClick={onCreate}>Create your first strategy →</button></div>}
      <StrategyGrid strategies={visible} subscriptionOf={desk.subscriptionOf} decimals={decimals} symbol={symbol} asset={STRATEGY_MARKETS} loadError={false} onOpen={(card) => { setSelected(card.strategyId); setDrawerId(card.strategyId); }} />
    </>}
    <RecentCopyTrades fills={view === "yours" ? fills.filter((f) => f.owner.toLowerCase() === writes.address?.toLowerCase()) : fills} strategies={strategies} storeConnected={payload.stores.fills} decimals={decimals} symbol={symbol} nowMs={nowMs} />
    <details className="mt-10"><summary className="strat-h2 cursor-pointer">Memory market and shared playbooks</summary><MemoryMarket /></details>
    <p className="strat-mono-10 mt-8 max-w-2xl text-ink-muted">{STRATEGIES.disclosure(STRATEGY_MARKETS)}</p>
    {drawer && <CopyDrawer card={drawer} sub={desk.subscriptionOf(drawer.strategyId)} grant={vault?.grants.strategy ?? null} readable={desk.readable} writes={writes} availableBase={available} decimals={decimals} symbol={symbol} asset={STRATEGY_MARKETS} nowMs={nowMs} decisionsStore={payload.stores.decisions} onClose={() => setDrawerId(null)} />}
  </>;
}
