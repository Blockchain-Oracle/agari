"use client";

import { noEntryCutoffSec } from "@masayume/core/lifecycle";
import { ENTRY_BUFFER_SEC } from "@masayume/core/constants";
import { formatBaseUnits, formatUtc, parseDecimalToBaseUnits } from "@masayume/core/units";
import type { EventMarket } from "@masayume/core/types";
import { selectXWindow, X_CADENCES, xRefusalCopy, type XAsset } from "@masayume/core/x";
import { marketsProvider } from "@masayume/markets";
import { useLanes, useTick } from "@masayume/markets/react";
import { ArrowDownRight, ArrowUpRight, Check, Copy } from "lucide-react";
import { useState } from "react";
import { BitcoinMark, EthereumMark } from "@/components/icons/AssetMarks";
import { useVenue } from "@/features/markets/useVenue";
import { X_HANDLE } from "./copy";
import "./x-instruction.css";

const ASSETS = [{ name: "BTC", label: "Bitcoin", Mark: BitcoinMark }, { name: "ETH", label: "Ethereum", Mark: EthereumMark }] as const;
const AMOUNTS = ["5", "10", "25"] as const;

interface BuilderProps {
  enabled: boolean;
  balanceBase: bigint | null;
  decimals: number;
  symbol: string;
}

export function XInstructionBuilder(props: BuilderProps) {
  const { venueId } = useVenue();
  const lanes = useLanes(venueId);
  useTick(1000);
  return <XInstructionBuilderView {...props} markets={lanes?.ok && !lanes.stale ? lanes.value.lanes.flatMap(l => l.markets) : null}
    unavailable={Boolean(lanes && (!lanes.ok || lanes.stale))} nowMs={marketsProvider.nowMs()} />;
}

/** Uses the relay's exact selection rule; copying never sends an order. */
export function XInstructionBuilderView({ enabled, balanceBase, decimals, symbol, markets, unavailable, nowMs }: BuilderProps & {
  markets: readonly EventMarket[] | null; unavailable: boolean; nowMs: number;
}) {
  const [asset, setAsset] = useState<XAsset>("BTC");
  const [side, setSide] = useState("up");
  const [amount, setAmount] = useState("5");
  const [cadence, setCadence] = useState<keyof typeof X_CADENCES>("5m");
  const [copied, setCopied] = useState("");
  const selection = markets ? selectXWindow(markets, { asset, intervalSec: X_CADENCES[cadence] }, nowMs) : null;
  const stake = parseDecimalToBaseUnits(amount, decimals);
  const amountError = !stake || stake <= 0n ? "Enter a positive amount." : balanceBase !== null && stake > balanceBase
    ? `Your X balance is ${formatBaseUnits(balanceBase, decimals)} ${symbol}. Use a smaller amount or add funds.` : "";
  const instruction = `${X_HANDLE} ${asset} ${side.toUpperCase()} ${amount} ${cadence}`;
  const canCopy = enabled && selection?.ok && !amountError;
  const amountInvalid = !stake || stake <= 0n;
  const maxAmount = balanceBase === null ? null : formatBaseUnits(balanceBase, decimals, { maxDp: decimals, minDp: 0, group: false });
  const status = selection?.ok ? `Entries close at ${formatUtc(noEntryCutoffSec(selection.market.expirySec, selection.market.intervalSec) * 1000, { withSeconds: true })}.`
    : selection ? xRefusalCopy({ refusalCode: selection.code, entryClosesAtSec: selection.market ? noEntryCutoffSec(selection.market.expirySec, selection.market.intervalSec) : null,
      nextWindowAtSec: selection.code === "window-not-started" ? selection.market?.tradingStartSec : null }).detail
    : unavailable ? "Live Windows could not be checked. Try again shortly." : "Checking live Windows…";
  const copy = async () => {
    if (!canCopy) return;
    try { await navigator.clipboard.writeText(instruction); setCopied(instruction); }
    catch { setCopied("Copy failed. Select the instruction text and copy it."); }
  };
  return <section id="x-instruction" className="xi" aria-label="Build an X instruction">
    <header className="xi-heading">
      <h2>Make your call.</h2>
      <p>Choose. Copy. Post on X.</p>
    </header>
    <div className="xi-choices">
      <fieldset className="xi-field">
        <legend>Asset</legend>
        <div className="xi-pair">
          {ASSETS.map(({ name, label, Mark }) => <button key={name} type="button" className="xi-asset" aria-pressed={asset === name} aria-label={name} onClick={() => setAsset(name)}>
            <Mark className="xi-asset-mark" /><span><strong>{name}</strong><small>{label}</small></span>
            {asset === name && <Check className="xi-check" aria-hidden />}
          </button>)}
        </div>
      </fieldset>
      <fieldset className="xi-field">
        <legend>Direction</legend>
        <div className="xi-pair">
          <button type="button" className="xi-side" data-side="up" aria-pressed={side === "up"} aria-label="UP / LONG" onClick={() => setSide("up")}>
            <ArrowUpRight aria-hidden /><span><strong>UP</strong><small>Long</small></span>
          </button>
          <button type="button" className="xi-side" data-side="down" aria-pressed={side === "down"} aria-label="DOWN / SHORT" onClick={() => setSide("down")}>
            <ArrowDownRight aria-hidden /><span><strong>DOWN</strong><small>Short</small></span>
          </button>
        </div>
      </fieldset>
    </div>
    <fieldset className="xi-field xi-timeframes">
      <legend>Timeframe <span>Live availability</span></legend>
      <div className="xi-cadences">
        {Object.entries(X_CADENCES).map(([name, intervalSec]) => {
          const window = markets ? selectXWindow(markets, { asset, intervalSec }, nowMs) : null;
          const label = window?.ok ? "Open" : window?.code === "window-not-started" ? "Soon" : window?.code === "opening-price-pending" ? "Starting" : window ? "Closed" : unavailable ? "Unavailable" : "Checking";
          return <button key={name} type="button" className="xi-cadence" aria-pressed={cadence === name} aria-label={`${name}, ${label.toLowerCase()}`}
            disabled={!window?.ok} data-open={Boolean(window?.ok)} onClick={() => setCadence(name as keyof typeof X_CADENCES)}>
            <strong>{name}</strong><small><i aria-hidden />{label}</small>
          </button>;
        })}
      </div>
      <p className="xi-window-status" data-open={Boolean(selection?.ok)} role="status">{status}</p>
    </fieldset>
    <fieldset className="xi-field xi-amount-field">
      <legend>Amount <span>X balance · {maxAmount ?? "—"} {symbol}</span></legend>
      <div className="xi-amount-row">
        <label className="xi-amount"><input aria-label={`Amount (${symbol})`} aria-invalid={Boolean(amountError)} aria-describedby={amountError ? "x-amount-error" : undefined}
          inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} /><span>{symbol}</span></label>
        <div className="xi-quick" role="group" aria-label="Quick amounts">
          {AMOUNTS.map(value => <button key={value} type="button" aria-pressed={amount === value} disabled={balanceBase !== null && BigInt(value) * 10n ** BigInt(decimals) > balanceBase} onClick={() => setAmount(value)}>{value}</button>)}
          <button type="button" disabled={!maxAmount || !balanceBase} aria-label="Use available X balance" onClick={() => maxAmount && setAmount(maxAmount)}>Max</button>
        </div>
      </div>
      {amountError && <p id="x-amount-error" className="xi-error">{amountError}</p>}
    </fieldset>
    <div className="xi-post" data-side={side}>
      <div className="xi-post-label">Your X post <span>Preview</span></div>
      <code><span className="xi-handle">{X_HANDLE}</span><span className="xi-command">{asset} <b>{side.toUpperCase()}</b> {amountInvalid ? "…" : amount} {cadence}</span></code>
      <button className="xi-copy" type="button" disabled={!canCopy} onClick={() => void copy()}>
        {copied === instruction ? <Check aria-hidden /> : <Copy aria-hidden />}{copied === instruction ? "Copied — paste into X" : "Copy instruction"}
      </button>
      {!enabled && <p className="xi-setup">Complete wallet, funding and X setup above to enable copying.</p>}
      {copied.startsWith("Copy failed") && <p className="xi-setup" role="alert">{copied}</p>}
    </div>
    <p className="xi-timing">Entries close {ENTRY_BUFFER_SEC}s before the Window ends. Post early enough for X delivery; availability is checked again on arrival.</p>
  </section>;
}
