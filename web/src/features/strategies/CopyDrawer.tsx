"use client";

import { parseStrategyMetadata, type StrategySubscription } from "@masayume/core/strategies";
import type { VaultGrant } from "@masayume/core/vault";
import { addressUrl, txUrl } from "@masayume/core/urls";
import { XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ConnectButton } from "@/features/markets/wallet";
import { AgentMemory } from "./AgentMemory";
import { AgentPortrait } from "./AgentPortrait";
import { progressCaps } from "./copy-progress";
import { capsFor, money, parseAmount } from "./format";
import { strategyIdentity } from "./identity";
import { copyStateOf, COPY_STATE_LABEL } from "./lifecycle";
import type { StrategyWire } from "./protocol";
import { RecordCard } from "./RecordCard";
import { StrategyActivity } from "./StrategyActivity";
import type { DeskWriteResult, useDeskWrites } from "./useDeskWrites";
import { useSubscriptionFee } from "./useSubscriptionFee";
import { useStrategyHealth } from "./useStrategies";
import "./strategies.css";
import "./builder.css";

interface CopyDrawerProps {
  card: StrategyWire; sub: StrategySubscription | null; grant: VaultGrant | null; readable: boolean;
  writes: ReturnType<typeof useDeskWrites>; availableBase: bigint; decimals: number; symbol: string;
  asset: string; nowMs: number; decisionsStore: boolean; onClose: () => void;
}

/** All copy management uses the same current fee and saved two-step permission flow. */
export function CopyDrawer({ card, sub, grant, readable, writes, availableBase, decimals, symbol, asset, nowMs, decisionsStore, onClose }: CopyDrawerProps) {
  const ownGrant = grant && sub?.grantId === grant.grantId && !grant.revoked ? grant : null;
  const [budget, setBudget] = useState(() => ownGrant ? money(ownGrant.budgetBase, decimals) : "");
  const [perTrade, setPerTrade] = useState(() => money(ownGrant?.caps.maxStakePerTradeBase ?? BigInt(card.envelope.maxStakePerTradeBase), decimals));
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const [result, setResult] = useState<DeskWriteResult | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const currentFee = useSubscriptionFee(card.strategyId, writes.busy);
  const heartbeat = useStrategyHealth([card.strategyId]);
  const health = heartbeat?.ok && !heartbeat.stale && heartbeat.value.reachable ? heartbeat.value.strategies[card.strategyId] : null;
  const { name, seed } = strategyIdentity(card);
  const meta = parseStrategyMetadata(card.metadata);
  const state = copyStateOf(card, sub, grant, Math.floor(nowMs / 1000), readable);
  const pending = writes.pending?.strategyId === card.strategyId ? writes.pending : null;
  const anotherPending = Boolean(writes.pending && !pending);
  const targetBase = pending ? BigInt(pending.budgetBase) : parseAmount(budget, decimals);
  const ceilingBase = pending ? BigInt(pending.caps.maxStakePerTradeBase) : parseAmount(perTrade, decimals);
  const envelope = { maxStakePerTradeBase: BigInt(card.envelope.maxStakePerTradeBase), maxDailySpendBase: BigInt(card.envelope.maxDailySpendBase), maxOpenPositions: card.envelope.maxOpenPositions, maxPriceRaw: BigInt(card.envelope.maxPriceRaw) };
  const caps = pending ? progressCaps(pending) : capsFor("balanced", ceilingBase, targetBase, decimals, envelope);
  const reusable = availableBase + (grant && !grant.revoked ? grant.budgetBase : 0n);
  const topUp = !pending && targetBase > reusable ? targetBase - reusable : 0n;
  const valid = targetBase > 0n && ceilingBase > 0n && ceilingBase <= envelope.maxStakePerTradeBase && ceilingBase <= targetBase;
  const disabled = Boolean(writes.busy) || !writes.canSign || !readable || anotherPending;
  const withdrawBase = parseAmount(withdrawAmount, decimals);
  const fundBase = parseAmount(fundAmount, decimals);
  const withdrawable = availableBase + (ownGrant?.budgetBase ?? 0n);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const nodes = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? [])].filter((node) => node.getClientRects().length > 0);
      const first = nodes[0]; const last = nodes.at(-1);
      if (!first) { event.preventDefault(); panel.current?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", onKey); previousFocus?.focus(); };
  }, []);

  const perform = async (operation: () => Promise<DeskWriteResult>) => {
    setResult(null);
    try { setResult(await operation()); } catch (error) { setResult({ ok: false, reason: error instanceof Error ? error.message : "The wallet action needs checking." }); }
    currentFee.refresh();
  };
  const confirm = () => {
    if (!valid || currentFee.fee === null) return;
    void perform(() => writes.join({ strategyId: BigInt(card.strategyId), runner: card.runner as `0x${string}`, depositBase: topUp, budgetBase: targetBase, caps, feeBase: currentFee.fee! }));
  };
  return <div className="strat-drawer-root" onClick={onClose}>
    <div className="strat-drawer-scrim" />
    <div ref={panel} tabIndex={-1} className="strat-drawer" role="dialog" aria-modal="true" aria-labelledby="copy-strategy-title" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={onClose} aria-label="Close strategy" className="strat-drawer-close"><XIcon aria-hidden="true" /></button>
      <div className="mb-5 flex items-center gap-3 pr-8"><AgentPortrait seed={seed} name={name} /><div className="min-w-0"><h2 id="copy-strategy-title" className="strat-drawer-name">{name}</h2><a href={addressUrl(card.runner as `0x${string}`)} target="_blank" rel="noreferrer" className="strat-meta text-ink-muted">Runner on Somnia ↗</a></div></div>
      <p className="strat-drawer-body mb-5">{meta?.description || "A published strategy with enforced trading limits."} Markets: {asset}.</p>
      <RecordCard record={card.record} decimals={decimals} symbol={symbol} />
      <div className="strat-drawer-rule mt-5"><p className="strat-meta mb-2 text-vermilion">{COPY_STATE_LABEL[state]}</p><p className="strat-drawer-body">{state === "copying" ? "Your permission is active. A trade still needs a signal and fresh risk checks." : state === "checking" ? "Checking your current vault permission and registry consent before making changes." : state === "inactive" ? "This strategy is not accepting new subscriptions. Existing consent can be paused." : "Review a new permission to start or resume. Publishing alone does not fund or activate a copy."}</p></div>
      <StrategyActivity state={state} grant={grant && sub?.grantId === grant.grantId ? grant : null} health={health ?? null} nowMs={nowMs} />
      {result && <div className={result.ok ? "copy-progress mb-5" : "agent-builder-error mb-5"} role="status"><p>{result.ok ? "Confirmed. Your balances and permissions are refreshing." : result.reason}</p>{result.txHash && <a href={txUrl(result.txHash)} target="_blank" rel="noreferrer">View transaction ↗</a>}</div>}
      {pending && <div className="copy-progress mb-5"><strong>{writes.busy ? "Copy setup in progress." : pending.stage === "subscribe-ready" ? "Permission saved. Subscription remains." : "An interrupted step needs checking."}</strong><p>{writes.busy ? "Waiting for wallet and chain confirmations. Your progress is saved." : "We will check this setup before continuing. The deposit will not be repeated."}</p>{pending.grantTx && <a className="block mt-2" href={txUrl(pending.grantTx as `0x${string}`)} target="_blank" rel="noreferrer">Permission transaction ↗</a>}{pending.subscribeTx && <a className="block mt-2" href={txUrl(pending.subscribeTx as `0x${string}`)} target="_blank" rel="noreferrer">Subscription transaction ↗</a>}<button className="desk-pill mt-3" disabled={disabled} onClick={() => void perform(writes.releasePending)}>{pending.releasePending ? "Check permission release" : "Release this permission"}</button></div>}
      {!writes.address ? <ConnectButton /> : <>
        {anotherPending && <p className="agent-builder-error mb-4">Finish or release strategy #{writes.pending?.strategyId} from Your strategies first.</p>}
        {card.active && <div className="space-y-4">
          <label className="desk-field-label block">Total budget · {symbol}<input className="strat-input mt-2" inputMode="decimal" value={pending ? money(targetBase, decimals) : budget} disabled={Boolean(pending) || disabled} onChange={(e) => setBudget(e.target.value)} placeholder="0.00" /></label>
          <label className="desk-field-label block">Most per trade · {symbol}<input className="strat-input mt-2" inputMode="decimal" value={pending ? money(ceilingBase, decimals) : perTrade} disabled={Boolean(pending) || disabled} onChange={(e) => setPerTrade(e.target.value)} /></label>
          <p className="strat-drawer-body">Strategy maximum: {money(envelope.maxStakePerTradeBase, decimals, symbol)} per trade. Your limit must fit within your budget. This permission lasts 30 days.</p>
          {valid && <p className="strat-drawer-body">Your permission: {money(caps.maxStakePerTradeBase, decimals, symbol)} per trade, {money(caps.maxDailySpendBase, decimals, symbol)} per day, {caps.maxOpenPositions} open position{caps.maxOpenPositions === 1 ? "" : "s"}, {caps.maxPriceRaw === 0n ? "without an entry-price ceiling" : `with a maximum entry price of ${money(caps.maxPriceRaw, decimals, symbol)} per share`}.</p>}
          <div className="copy-progress"><p><strong>Subscription fee: {currentFee.fee === null ? "checking…" : money(currentFee.fee, decimals, symbol)}</strong></p><p>This fee is charged each time you subscribe, including a resume or a change to your limits. The vault budget is separate.</p>{currentFee.error && <p role="alert">{currentFee.error}</p>}<button type="button" className="desk-pill mt-2" disabled={Boolean(writes.busy)} onClick={currentFee.refresh}>Refresh fee</button></div>
          {valid && <p className="strat-drawer-body">{pending ? "Existing permission budget" : "Additional wallet deposit"}: {money(pending ? targetBase : topUp, decimals, symbol)}.{currentFee.fee !== null && !pending && <> Wallet total for this setup: {money(topUp + currentFee.fee, decimals, symbol)}, plus network gas.</>}</p>}
          {grant && !grant.revoked && (!sub || sub.grantId !== grant.grantId) && <p className="agent-builder-error">This replaces your current strategy permission and stops its future copies. Its unspent budget becomes available for this setup.</p>}
          <p className="strat-drawer-body">The wallet requests permission first, then subscription consent. Token approval may add a wallet prompt. Losses are possible within your limits.</p>
          <button type="button" className="desk-btn-primary w-full" disabled={disabled || !valid || currentFee.fee === null || Boolean(pending?.releasePending)} onClick={confirm}>{writes.busy === "join" ? "Checking wallet steps…" : pending ? "Check and finish subscription" : state === "copying" ? "Update budget and limits" : sub ? "Resume with these limits" : "Fund permission and copy"}</button>
        </div>}
        {sub?.active && <button className="strat-pause mt-5" disabled={disabled || Boolean(pending)} onClick={() => void perform(() => writes.pause(BigInt(card.strategyId), sub.grantId))}>Pause future copies</button>}
        {ownGrant && (state === "copying" || state === "unfunded") && <details className="mt-5"><summary className="strat-meta cursor-pointer">Add budget without changing limits</summary><p className="strat-drawer-body my-3">Move up to {money(availableBase, decimals, symbol)} of available Vault funds into this permission. One transaction; no subscription fee. Deposit more in your <a className="text-vermilion" href="/portfolio">Trading Balance</a> first if needed.</p><label className="desk-field-label block">Amount · {symbol}<input className="strat-input mt-2" inputMode="decimal" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} /></label><button className="desk-pill mt-3" disabled={disabled || Boolean(pending) || fundBase <= 0n || fundBase > availableBase} onClick={() => void perform(() => writes.fundBudget(ownGrant.grantId, fundBase))}>Move Vault funds into budget</button></details>}
        <details className="mt-5"><summary className="strat-meta cursor-pointer">Withdraw available funds</summary><p className="strat-drawer-body my-3">Up to {money(withdrawable, decimals, symbol)} is available including this copy's unspent budget. Withdrawing from its budget revokes this permission first. Open positions settle separately.</p><label className="desk-field-label block">Amount · {symbol}<input className="strat-input mt-2" inputMode="decimal" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} /></label><button className="desk-pill mt-3" disabled={disabled || Boolean(pending) || withdrawBase <= 0n || withdrawBase > withdrawable} onClick={() => void perform(() => writes.withdraw(ownGrant?.grantId ?? null, withdrawBase))}>Withdraw to wallet</button></details>
      </>}
      {card.agent && <details className="mt-6"><summary className="strat-meta mb-3 cursor-pointer">Agent memory and decisions</summary><AgentMemory agent={card.agent} storeConnected={decisionsStore} asset={asset} nowMs={nowMs} /></details>}
      {(card.playbook || meta?.playbook) && <details className="mt-5"><summary className="strat-meta cursor-pointer">Public playbook</summary><pre className="strat-drawer-body mt-3 whitespace-pre-wrap break-words">{card.playbook ?? meta?.playbook}</pre></details>}
    </div>
  </div>;
}
