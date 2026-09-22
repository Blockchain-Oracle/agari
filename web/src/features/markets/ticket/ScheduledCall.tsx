"use client";

import { formatCadence } from "@agari/core/copy";
import { ownCentsOf } from "@agari/core/orders";
import type { RestedOrder } from "@agari/core/ports";
import type { EventMarket } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { txUrl } from "@agari/core/urls";
import Link from "next/link";
import { Hash, Money } from "@/components/data";
import { PREOPEN } from "@/lib/copy";
import { laneAssetLabel } from "../lanes/lane-view";
import { SIDE_WORD } from "../side-styles";
import { useCancelResting } from "./useCancelResting";
import { useWhen } from "@/lib/when";

export interface ScheduledCallCancel {
  busy: boolean;
  note: string | null;
  done: boolean;
  onCancel: () => void;
}

export interface ScheduledCallViewProps {
  rested: RestedOrder;
  market: Pick<EventMarket, "asset" | "lane" | "intervalSec" | "tradingStartSec" | "lockAtSec">;
  decimals: number;
  symbol: string;
  /** Null where nothing can sign (a fixture). */
  cancel: ScheduledCallCancel | null;
  onAnother: () => void;
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="tk-readout-cell">
      <span className="tk-readout-label">{label}</span>
      <span className="tk-readout-value">{children}</span>
    </div>
  );
}

/**
 * The receipt a scheduled call leaves in the ticket (D-088): what rests, at what price, what is held, and when it
 * fills or comes back — in the ticket's inline gate block, so it sits where the composer was. Cancel is live at once;
 * the escrow returns to venue credit and the row leaves Portfolio's Open tab on the next read.
 */
export function ScheduledCallView({ rested, market, decimals, symbol, cancel, onAnother }: ScheduledCallViewProps) {
  const when = useWhen();
  const cents = ownCentsOf(rested.side, rested.priceTicks);
  const untilLock = rested.expireSec >= market.lockAtSec;
  return (
    <div className="tk-gate" role="status">
      <div className="tk-gate-eyebrow">{PREOPEN.receipt.eyebrow}</div>
      <div className="tk-readout tk-readout--live">
        <Cell label={PREOPEN.receipt.held}>
          <Money value={rested.escrowBase} decimals={decimals} />
        </Cell>
        <Cell label={PREOPEN.receipt.contracts}>{formatBaseUnits(rested.contractsRaw, decimals, { minDp: 0 })}</Cell>
        <Cell label={PREOPEN.receipt.price}>{cents}¢</Cell>
      </div>
      <p className="tk-gate-line">
        {PREOPEN.receipt.window}: {laneAssetLabel(market.asset, market.lane)} · {formatCadence(market.intervalSec)} · {SIDE_WORD[rested.side]} · {PREOPEN.receipt.opens(when(market.tradingStartSec))}
      </p>
      <p className="tk-gate-line">
        {PREOPEN.receipt.fillsBy} {untilLock ? PREOPEN.receipt.lock : PREOPEN.receipt.bell}.
      </p>
      <p className="tk-gate-line">
        {PREOPEN.receipt.tx} <Hash value={rested.txHash} href={txUrl(rested.txHash)} />
      </p>
      {cancel?.note && (
        <p className="tk-gate-line" role="status">
          {cancel.note}
        </p>
      )}
      <div className="tk-gate-actions">
        {cancel && !cancel.done && (
          <button type="button" className="tk-gate-cta" disabled={cancel.busy} onClick={cancel.onCancel} data-cursor="hover">
            {cancel.busy ? PREOPEN.receipt.cancelling : PREOPEN.receipt.cancel}
          </button>
        )}
        <Link className="tk-gate-quiet" href="/portfolio" data-cursor="hover">
          {PREOPEN.receipt.portfolio}
        </Link>
        <button type="button" className="tk-gate-quiet" onClick={onAnother} data-cursor="hover">
          {PREOPEN.receipt.another}
        </button>
      </div>
    </div>
  );
}

interface ScheduledCallProps {
  rested: RestedOrder;
  market: EventMarket;
  decimals: number;
  symbol: string;
  onAnother: () => void;
}

/** The live receipt: Cancel sends `user_cancel_orders` on the call's own handle. */
export function ScheduledCall({ rested, market, decimals, symbol, onAnother }: ScheduledCallProps) {
  const c = useCancelResting();
  const cancel: ScheduledCallCancel | null = c.canSign ? { busy: c.busy, note: c.note, done: c.done, onCancel: () => void c.cancel(rested.marketId, [{ node: rested.node, seq: rested.seq }]) } : null;
  return <ScheduledCallView rested={rested} market={market} decimals={decimals} symbol={symbol} cancel={cancel} onAnother={onAnother} />;
}
