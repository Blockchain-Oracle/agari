/** Chain views → the settler's pure input, and the labels its log lines use. */
import { isDrained, isProgramSeat, SEAT_FLAG, type LedgerState } from "@agari/markets/ops/settle";
import { MARKET_FLAG, seriesLaneKey, type MarketView, type SeriesView } from "@agari/markets/ops";
import type { SettleInput } from "./decide";

const hhmm = (sec: number) => new Date(sec * 1000).toISOString().slice(11, 16);

export const seriesLabel = seriesLaneKey;

export const marketLabel = (s: SeriesView | undefined, m: MarketView) =>
  `${s ? seriesLabel(s) : m.data.series.slice(0, 6)} #${m.data.index} ${hhmm(Number(m.data.tradingStart))}–${hhmm(Number(m.data.expiry))}Z`;

const present = (p: { source: number }) => p.source !== 0;

export function settleInput(
  m: MarketView,
  series: SeriesView,
  ctx: { nowSec: number; retentionSec: number; redeemGraceSec: number; bookOrderCount: number | null; ledger: LedgerState | null | undefined },
): SettleInput {
  const d = m.data;
  const version = series.data.policyVersions[d.policyVersion];
  const ledgerClosed = (d.flags & MARKET_FLAG.ledgerClosed) !== 0;
  return {
    nowSec: ctx.nowSec,
    state: d.state,
    expirySec: Number(d.expiry),
    openDeadlineSec: Number(d.openDeadline),
    closeDeadlineSec: Number(d.closeDeadline),
    prints: { open: present(d.open), close: present(d.close), checkOpen: present(d.checkOpen), checkClose: present(d.checkClose) },
    check: { configured: (version?.check.source ?? 0) !== 0, admissionSec: version?.checkAdmissionSec ?? 0 },
    bookReleased: (d.flags & MARKET_FLAG.bookReleased) !== 0,
    ledgerClosed,
    dependents: d.dependents,
    resolvedSec: Number(d.resolvedTs),
    retentionSec: ctx.retentionSec,
    redeemGraceSec: ctx.redeemGraceSec,
    bookOrderCount: ctx.bookOrderCount,
    seats:
      ledgerClosed || !ctx.ledger
        ? null
        : ctx.ledger.seats.map((s) => ({ index: s.index, program: isProgramSeat(s), bonded: (s.flags & SEAT_FLAG.bonded) !== 0, drained: isDrained(s) })),
  };
}
