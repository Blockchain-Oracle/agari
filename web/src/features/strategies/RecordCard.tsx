import type { EquityPoint } from "@masayume/core/projection";
import { EquitySparkline } from "@/features/markets/history";
import { STRATEGIES } from "./copy";
import { RecordStat } from "./DeskInputs";
import { money } from "./format";
import type { StrategyWire } from "./protocol";
import "./desk.css";

/**
 * The record, as a curve + a tight trio (reference `recordCard`): cumulative P&L that rises on wins
 * and drops on losses over exactly three numbers. Nothing renders until a trade has settled — an
 * empty placeholder is noise. Win rate leads the card in the reference; the numbers below keep it honest.
 */
export function RecordCard({ record, decimals, symbol }: { record: StrategyWire["record"]; decimals: number; symbol: string }) {
  if (record.settled === 0) return null;
  const decided = record.wins + record.losses;
  const winRate = decided > 0 ? Math.round((100 * record.wins) / decided) : 0;
  const net = BigInt(record.netBase);
  const netUp = net >= 0n;
  const netStr = `${netUp ? "+" : "−"}${money(net < 0n ? -net : net, decimals)}`;
  const points: EquityPoint[] = [{ atMs: null, cumulativeBase: 0n }, ...record.curve.map((p) => ({ atMs: p.atSec * 1000, cumulativeBase: BigInt(p.cumBase) }))];
  return (
    <div className="desk-record">
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="desk-eyebrow text-ink/40">{STRATEGIES.desk.record.title}</span>
        <span className="desk-fine uppercase tracking-[0.16em] text-ink/30">{STRATEGIES.desk.record.meta(record.settled)}</span>
      </div>
      <div className="flex items-baseline gap-2.5 px-4 pt-2.5">
        <span className="desk-winrate text-ink">{winRate}%</span>
        <span className="desk-note uppercase tracking-[0.16em] text-ink/45">{STRATEGIES.desk.record.winRate}</span>
      </div>
      <div className="px-4 pt-2 pb-2">
        <EquitySparkline points={points} decimals={decimals} className="w-full" />
      </div>
      <div className="desk-trio">
        <RecordStat label={STRATEGIES.desk.record.won} value={String(record.wins)} />
        <RecordStat label={STRATEGIES.desk.record.lost} value={String(record.losses)} />
        <RecordStat label={`${STRATEGIES.desk.record.net} · ${symbol}`} value={netStr} accent={netUp ? "up" : "down"} />
      </div>
    </div>
  );
}
