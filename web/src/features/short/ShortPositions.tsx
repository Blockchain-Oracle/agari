"use client";

import { shortBookTotals, type LeverageMark, type LeveragePosition } from "@agari/core/leverage";
import { isOk } from "@agari/core/schemas";
import { formatBaseUnits } from "@agari/core/units";
import { useLeverageMark, useMarket, useMyLeveragePositions } from "@agari/markets/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Money } from "@/components/data";
import { useWalletSession } from "@/lib/wallet-session";
import { useLeverageWrites } from "../leverage";
import { ConnectButton } from "../markets/wallet";
import { SHORT } from "./copy";
import { ShortPositionCard } from "./ShortPositionCard";

type Writes = ReturnType<typeof useLeverageWrites>;
type Report = (positionId: string, mark: LeverageMark | null) => void;

interface ShortPositionsProps {
  symbol: string;
  decimals: number;
  nowMs: number;
}

/**
 * The wallet's shorts, live ones first.
 *
 * Each card reads its own mark, and reports it up so the one summary line can be the same arithmetic the cards
 * use (`shortBookTotals`) rather than a second, differently-rounded one. The report is guarded on value, not
 * identity, so a poll that returns the same mark re-renders nothing.
 */
export function ShortPositions({ symbol, decimals, nowMs }: ShortPositionsProps) {
  const { positions: words } = SHORT;
  const { address } = useWalletSession();
  const reading = useMyLeveragePositions(address);
  const writes = useLeverageWrites();
  const [marks, setMarks] = useState<ReadonlyMap<string, LeverageMark | null>>(() => new Map());

  const report = useCallback<Report>((positionId, mark) => {
    setMarks((prev) => {
      const held = prev.get(positionId) ?? null;
      if (sameMark(held, mark)) return prev;
      const next = new Map(prev);
      next.set(positionId, mark);
      return next;
    });
  }, []);

  const held = reading && isOk(reading) ? reading.value : [];
  const live = useMemo(() => held.filter((p) => p.status === "live"), [held]);
  const done = useMemo(() => held.filter((p) => p.status !== "live"), [held]);
  const totals = useMemo(() => shortBookTotals(live.map((position) => ({ position, mark: marks.get(position.positionId.toString()) ?? null }))), [live, marks]);

  if (address === null) {
    return (
      <div className="sh-empty">
        <p className="sh-empty-t">{words.connect}</p>
        <div className="sh-cta-row">
          <ConnectButton />
        </div>
      </div>
    );
  }
  if (held.length === 0) {
    return (
      <div className="sh-empty">
        <p className="sh-empty-t">{words.empty}</p>
        <p className="sh-empty-d">{words.emptyBody}</p>
      </div>
    );
  }

  const card = (position: LeveragePosition) => (
    <Row key={position.positionId.toString()} position={position} symbol={symbol} decimals={decimals} nowMs={nowMs} writes={writes} report={report} />
  );

  return (
    <div className="sh-book">
      {live.length > 0 && (
        <>
          <div className="sh-totals">
            <span className="sh-totals-n">{words.totals(totals.priced, totals.live)}</span>
            <span className="sh-totals-flex" />
            <span className="sh-totals-k">{words.staked}</span>
            <Money value={totals.stakedBase} decimals={decimals} symbol={symbol} />
            <span className="sh-totals-k">{words.worth}</span>
            <Money value={totals.equityBase} decimals={decimals} symbol={symbol} />
            <span className="sh-totals-pnl">
              <Money value={totals.pnlBase} decimals={decimals} tone="pnl" />
            </span>
          </div>
          <ul className="sh-list">{live.map(card)}</ul>
        </>
      )}
      {done.length > 0 && (
        <>
          <p className="sh-done-head">{words.settledTitle}</p>
          <ul className="sh-list">{done.map(card)}</ul>
        </>
      )}
    </div>
  );
}

function Row({
  position,
  symbol,
  decimals,
  nowMs,
  writes,
  report,
}: {
  position: LeveragePosition;
  symbol: string;
  decimals: number;
  nowMs: number;
  writes: Writes;
  report: Report;
}) {
  const market = useMarket(position.marketId);
  const marketKnown = market !== null && isOk(market);
  const reading = useLeverageMark(position.status === "live" ? position.positionId : null);
  const mark = reading && isOk(reading) ? reading.value : null;
  const id = position.positionId.toString();
  useEffect(() => report(id, mark), [report, id, mark]);
  return (
    <ShortPositionCard
      position={position}
      market={marketKnown && market.value ? { asset: market.value.asset, intervalSec: market.value.intervalSec } : null}
      marketKnown={marketKnown}
      mark={mark}
      symbol={symbol}
      decimals={decimals}
      nowMs={nowMs}
      busy={writes.busy}
      canSign={writes.canSign && writes.address === position.owner}
      onClose={(p, min) => void writes.close(p.positionId, p.marketId, min, decimals, symbol).then(() => report(id, null))}
      onSettle={(p) => void writes.settle(p.positionId, p.marketId)}
      onClaim={(p) => void writes.claim(p.positionId, p.marketId, p.owedBase, decimals, symbol)}
    />
  );
}

function sameMark(a: LeverageMark | null, b: LeverageMark | null): boolean {
  if (a === null || b === null) return a === b;
  return a.markBase === b.markBase && a.filledRaw === b.filledRaw && a.lineBase === b.lineBase && a.knockable === b.knockable;
}
