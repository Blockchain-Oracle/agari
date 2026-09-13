"use client";

import type { MakerWindowView } from "@masayume/core/maker";
import { formatCadence } from "@masayume/core/market";
import type { EventMarket, MarketId } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import { EARN } from "./copy";
import { money2 } from "./format";
import type { EarnBusy } from "./useEarnWrites";

interface WindowsTableProps {
  open: MakerWindowView[];
  history: MakerWindowView[];
  /** Every Window the rows name, read in one round by the screen; a row whose Window has not landed prints "…". */
  markets: ReadonlyMap<MarketId, EventMarket>;
  decimals: number;
  symbol: string;
  nowMs: number;
  busy: EarnBusy | null;
  canSign: boolean;
  onMerge: (marketId: MarketId) => void;
  onSettle: (marketId: MarketId) => void;
}

function Row({ view, market, decimals, symbol, nowMs, busy, canSign, onMerge, onSettle }: { view: MakerWindowView; market: EventMarket | null } & Omit<WindowsTableProps, "open" | "history" | "markets">) {
  const { windows } = EARN;
  const closed = market !== null && nowMs > 0 && market.expirySec * 1000 <= nowMs;
  const pairs = view.yesRaw < view.noRaw ? view.yesRaw : view.noRaw;
  const contracts = (raw: bigint) => formatBaseUnits(raw, decimals, { minDp: 0, maxDp: 2 });
  let state: string;
  if (view.settled) state = windows.settled;
  else if (closed) state = windows.closed;
  else if (pairs > 0n) state = windows.paired(contracts(pairs));
  else if (view.yesRaw > 0n || view.noRaw > 0n) state = windows.oneSided(view.yesRaw > 0n ? "UP" : "DOWN", contracts(view.yesRaw > 0n ? view.yesRaw : view.noRaw));
  else state = windows.resting;
  const mergeBusy = busy === `merge:${view.marketId}`;
  const settleBusy = busy === `settle:${view.marketId}`;
  return (
    <tr>
      <td className="ea-td">
        {market ? `${market.asset} ${formatCadence(market.intervalSec)}` : "…"}
        <span className="ea-td-sub"> · {view.quoteCount} quotes</span>
      </td>
      <td className="ea-td ea-td--num">{money2(view.deployedBase, decimals)}</td>
      <td className="ea-td ea-td--num">
        {contracts(view.yesRaw)} / {contracts(view.noRaw)}
      </td>
      <td className="ea-td">
        {state}
        {canSign && !view.settled && pairs > 0n && (
          <button type="button" onClick={() => onMerge(view.marketId)} disabled={mergeBusy} className="pl-settle ea-row-btn" data-cursor="hover">
            {mergeBusy ? windows.busy : windows.merge}
          </button>
        )}
        {canSign && !view.settled && closed && (
          <button type="button" onClick={() => onSettle(view.marketId)} disabled={settleBusy} className="pl-settle ea-row-btn" data-cursor="hover">
            {settleBusy ? windows.busy : windows.settle}
          </button>
        )}
      </td>
      <td className="ea-td ea-td--num">
        {view.realizedBase === null ? "–" : `${view.realizedBase < 0n ? "−" : "+"}${money2(view.realizedBase < 0n ? -view.realizedBase : view.realizedBase, decimals)} ${symbol}`}
      </td>
    </tr>
  );
}

/** Ours: the exposure and exit accounting doc 03 asks for — one row per Window the maker is on, then the last settled ones. */
export function WindowsTable(props: WindowsTableProps) {
  const { windows } = EARN;
  const rows = [...props.open, ...props.history.filter((h) => h.settled).slice(0, 10)];
  if (rows.length === 0) return <div className="pl-slip-empty">{windows.empty}</div>;
  return (
    <div className="ea-table-wrap">
      <table className="ea-table">
        <thead>
          <tr>
            <th className="ea-th">{windows.window}</th>
            <th className="ea-th ea-td--num">{windows.deployed}</th>
            <th className="ea-th ea-td--num">{windows.inventory} UP / DOWN</th>
            <th className="ea-th">{windows.state}</th>
            <th className="ea-th ea-td--num">{windows.result}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((view) => (
            <Row key={`${view.marketId}:${view.settled ? "s" : "o"}`} view={view} market={props.markets.get(view.marketId) ?? null} decimals={props.decimals} symbol={props.symbol} nowMs={props.nowMs} busy={props.busy} canSign={props.canSign} onMerge={props.onMerge} onSettle={props.onSettle} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
