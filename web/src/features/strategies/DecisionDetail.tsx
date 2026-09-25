"use client";

import { Dialog } from "@base-ui/react/dialog";
import { formatCadence } from "@agari/core/copy";
import type { Signature } from "@agari/core/types";
import { txUrl } from "@agari/core/urls";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { assetPriceLine } from "@/features/markets/hero/units";
import { cn } from "@/lib/utils";
import { STRATEGIES } from "./copy";
import { DECISION } from "./decision-copy";
import { fillPriceCents, when, windowSpan } from "./decision-format";
import { money } from "./format";
import { shortAddress } from "./names";
import type { DecisionWire, FillWire } from "./protocol";
import "./decision.css";

const M = STRATEGIES.drawer.memory;

interface DecisionDetailProps {
  decision: DecisionWire | null;
  agentName: string;
  decimals: number;
  symbol: string;
  nowMs: number;
  onClose: () => void;
}

/**
 * One agent decision, whole: the Window, the model's read, the gate's ruling, the copies it placed and how the
 * Window settled, each transaction linked to Solana Explorer. A centred dialog on desktop, a bottom sheet on a
 * phone (21st: originui Dialog's centred popup, coss Drawer's bottom sheet with its grab bar), on base-ui's Dialog.
 */
export function DecisionDetail({ decision, agentName, decimals, symbol, nowMs, onClose }: DecisionDetailProps) {
  return (
    <Dialog.Root open={decision !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="decision-backdrop" />
        <Dialog.Popup className="decision-popup" data-strat-detail="">
          <span className="decision-bar" aria-hidden />
          <Dialog.Close className="strat-drawer-close" aria-label={DECISION.close}><XIcon aria-hidden="true" /></Dialog.Close>
          {decision && <DecisionBody d={decision} agentName={agentName} decimals={decimals} symbol={symbol} nowMs={nowMs} />}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DecisionBody({ d, agentName, decimals, symbol, nowMs }: { d: DecisionWire; agentName: string; decimals: number; symbol: string; nowMs: number }) {
  const asset = d.asset ?? null;
  const title = asset && d.intervalSec !== null ? DECISION.window(asset, formatCadence(d.intervalSec)) : DECISION.unknownWindow;
  const call = d.verdictSide === "none" ? M.noAnswer : M.call(d.verdictSide, d.confidence);
  const ruling = d.gate === "trade" && d.side ? M.sent(d.side, d.filled) : M.held;
  const print = (raw: string | null | undefined) => (raw && asset ? assetPriceLine(asset, BigInt(raw)) : "—");
  const trades = d.trades ?? [];
  return (
    <>
      <p className="strat-meta mb-1.5 tracking-[0.18em] text-vermilion">{DECISION.eyebrow} · {agentName}</p>
      <Dialog.Title className="decision-title">{title}</Dialog.Title>
      {d.outcome && <p className={cn("decision-outcome", `decision-outcome--${d.outcome}`)}>{M.outcome[d.outcome]}</p>}

      <Section title={DECISION.sections.window}>
        {d.window && <Row label={DECISION.rows.trading} value={windowSpan(d.window.startSec, d.window.expirySec, nowMs)} />}
        <Row label={DECISION.rows.opening} value={print(d.openingRaw)} />
        <Row label={DECISION.rows.closing} value={d.closingRaw ? print(d.closingRaw) : DECISION.pending} />
      </Section>

      <Section title={DECISION.sections.read}>
        <Row label={DECISION.rows.decided} value={when(d.decidedAtMs)} />
        <Row label={DECISION.rows.call} value={call} />
        <Row label={DECISION.rows.model} value={d.model} />
        <Dialog.Description className="decision-why">“{d.why}”</Dialog.Description>
      </Section>

      <Section title={DECISION.sections.gate}>
        <Row label={DECISION.rows.ruling} value={ruling} accent={d.gate === "trade"} />
        <p className="decision-note">{d.gateReason}</p>
      </Section>

      <Section title={DECISION.sections.trades}>
        {trades.length > 0 ? trades.map((t) => <TradeRow key={t.txHash} t={t} decimals={decimals} symbol={symbol} />) : <p className="decision-note">{d.gate === "trade" && d.filled > 0 ? DECISION.tradesUnlisted : DECISION.noTrades}</p>}
      </Section>

      <Section title={DECISION.sections.settlement}>
        <Row label={DECISION.rows.outcome} value={d.outcome && d.outcome !== "open" ? M.outcome[d.outcome] : DECISION.pending} />
        {d.settleTx && <a className="decision-link" href={txUrl(d.settleTx as Signature)} target="_blank" rel="noreferrer">{DECISION.rows.settledTx} ↗</a>}
      </Section>
    </>
  );
}

function TradeRow({ t, decimals, symbol }: { t: FillWire; decimals: number; symbol: string }) {
  const price = fillPriceCents(t.cashDeltaBase, t.tokenDeltaRaw);
  return (
    <div className="decision-trade">
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn("decision-side", t.side === "up" ? "decision-side--up" : "decision-side--down")}>{DECISION.trade.side(t.side)}</span>
        <span className="strat-mono-10 text-ink/40">{DECISION.trade.copier} {shortAddress(t.owner)}</span>
      </div>
      <dl className="decision-trade-facts">
        <div><dt>{DECISION.trade.stake}</dt><dd>{money(BigInt(t.cashDeltaBase), decimals, symbol)}</dd></div>
        <div><dt>{DECISION.trade.shares}</dt><dd>{money(BigInt(t.tokenDeltaRaw), decimals)}</dd></div>
        <div><dt>{DECISION.trade.price}</dt><dd>{price === null ? "—" : `${price}¢`}</dd></div>
        {t.payoutBase !== null && <div><dt>{DECISION.trade.payout}</dt><dd>{money(BigInt(t.payoutBase), decimals, symbol)}</dd></div>}
      </dl>
      <a className="decision-link" href={txUrl(t.txHash as Signature)} target="_blank" rel="noreferrer">{DECISION.explorer}</a>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="decision-section">
      <h3 className="decision-section-title">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="decision-row">
      <span className="decision-row-label">{label}</span>
      <span className={cn("decision-row-value", accent && "text-vermilion")}>{value}</span>
    </div>
  );
}
