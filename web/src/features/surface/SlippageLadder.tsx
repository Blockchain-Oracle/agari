"use client";

import { slippageLadder, stakeLadder, type SlippageRow } from "@masayume/core/surface";
import type { BookDepth, Side } from "@masayume/core/types";
import { bpsToOddsCents, formatBaseUnits } from "@masayume/core/units";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SIDE_WORD, SIDES } from "../markets/side-styles";
import { SURFACE } from "./copy";
import { centsText, contractsText, lotText } from "./format";

interface SlippageLadderProps {
  depth: BookDepth | null;
  hydrating: boolean;
  symbol: string;
  /** The pool's lot; null until read — the walk is not run on a guessed lot. */
  lotRaw: bigint | null;
  /** The venue's settlement fee; null until read — the payout column waits rather than assuming zero. */
  feeBps: number | null;
}

function Row({ row, decimals, symbol }: { row: SlippageRow; decimals: number; symbol: string }) {
  const copy = SURFACE.ladder;
  const nothing = row.contractsRaw === 0n;
  return (
    <div className={cn("sf-row", row.exhausted && "sf-row--beyond")}>
      <span className="sf-row-stake">
        {formatBaseUnits(row.stakeBase, decimals, { minDp: 0 })} <span className="sf-row-unit">{symbol}</span>
      </span>
      <span className="sf-row-num">{row.avgPriceBps === null ? "—" : `${bpsToOddsCents(row.avgPriceBps)}¢`}</span>
      <span className={cn("sf-row-num", row.slippageBps !== null && row.slippageBps > 0 && "sf-row-slip")}>{row.slippageBps === null ? "—" : row.slippageBps === 0 ? "0¢" : `+${centsText(row.slippageBps)}`}</span>
      <span className="sf-row-num">{nothing ? "—" : contractsText(row.contractsRaw, decimals)}</span>
      <span className="sf-row-num sf-row-pays">{nothing || row.payoutIfRightBase === null ? "—" : formatBaseUnits(row.payoutIfRightBase, decimals)}</span>
      <span className="sf-row-fill">{nothing ? copy.nothing : row.exhausted ? copy.beyond : copy.full}</span>
    </div>
  );
}

/**
 * §03 — the reference's strike ladder (`SurfacePage` L297–322: every strike priced off the surface)
 * becomes a stake ladder: every stake priced off the book, walked as an IOC taker would be. The
 * side toggle is the reference's chip; the highlighted rows are the ones the visible book can no
 * longer fill in full — the honest edge of what ten levels can say.
 */
export function SlippageLadder({ depth, hydrating, symbol, lotRaw, feeBps }: SlippageLadderProps) {
  const [side, setSide] = useState<Side>("up");
  const copy = SURFACE.ladder;
  const asks = depth ? (side === "up" ? depth.upAsks : depth.downAsks) : [];
  const ready = depth !== null && lotRaw !== null;
  const rows = ready ? slippageLadder(asks, stakeLadder(depth.decimals), depth.decimals, lotRaw, feeBps) : [];

  return (
    <div className="sf-ladder">
      <div className="sf-side-chips" role="group" aria-label={copy.side("")}>
        {SIDES.map((s) => (
          <button key={s} type="button" className={cn("sf-chip sf-chip--window", side === s && "sf-chip--on")} aria-pressed={side === s} onClick={() => setSide(s)} data-cursor="hover">
            {copy.side(SIDE_WORD[s])}
          </button>
        ))}
      </div>
      <div className="sf-box sf-box--table">
        <div className="sf-row sf-row--head">
          <span>{copy.stake}</span>
          <span className="sf-row-num">{copy.avg}</span>
          <span className="sf-row-num">{copy.vsTop}</span>
          <span className="sf-row-num">{copy.contracts}</span>
          <span className="sf-row-num">{copy.pays}</span>
          <span>{copy.fill}</span>
        </div>
        {!ready ? (
          <div className="sf-box-empty sf-box-empty--rows">{hydrating || depth === null || lotRaw === null ? copy.loading : copy.empty(SIDE_WORD[side])}</div>
        ) : asks.length === 0 ? (
          <div className="sf-box-empty sf-box-empty--rows">{copy.empty(SIDE_WORD[side])}</div>
        ) : (
          rows.map((row) => <Row key={row.stakeBase.toString()} row={row} decimals={depth.decimals} symbol={symbol} />)
        )}
      </div>
      {ready && (
        <div className="sf-params">
          <span>{copy.lot(lotText(lotRaw, depth.decimals))}</span>
          {feeBps !== null && <span>{copy.fee(feeBps)}</span>}
          <span>{copy.unguarded}</span>
        </div>
      )}
    </div>
  );
}
