import { deskCopy, mandateFromWire, nameOf, thresholdBps, type DeskMandate } from "@agari/core/desk";
import type { PreIpoSymbol } from "@agari/core/market";
import { DESK } from "./copy";
import { nextTopOfHour } from "./format";
import { CHECK_EVERY_SEC, GO_LIVE_CHECKS, LATE_AFTER_SEC, type ApprovalWire, type DeskViewWire, type SnapshotHoldingWire } from "./protocol";
import { pct } from "./format";

/**
 * The desk page's model from the wire (plan §5.7): decimal strings become bigints once, the state and the eyebrow are
 * decided once, and every panel reads a plain field. Pure, so `/dev/desk` builds the same model from fixtures.
 */
export interface HoldingRow {
  symbol: PreIpoSymbol;
  name: string;
  raw: bigint;
  valueE6: bigint | null;
  weightBps: number;
  targetBps: number;
  driftBps: number;
  premiumBps: number | null;
  /** "in line" · "3.1% over" · "1.4% under". */
  standing: string;
  flags: string[];
  /** The token price at every snapshot (S22 sparkline), oldest first; empty before two checks. */
  priceHistoryE8: bigint[];
}

export interface SeriesPoint {
  atSec: number;
  totalE6: bigint;
}

export type ChartRange = "1d" | "1w" | "all";
export const RANGE_SEC: Record<ChartRange, number | null> = { "1d": 86_400, "1w": 7 * 86_400, all: null };

/** The points inside a range and the move across it, in integer money; null move with fewer than two points. */
export function seriesInRange(series: readonly SeriesPoint[], range: ChartRange, nowSec: number): { points: SeriesPoint[]; deltaE6: bigint | null; bps: number | null } {
  const span = RANGE_SEC[range];
  const points = span === null ? [...series] : series.filter((p) => p.atSec >= nowSec - span);
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || points.length < 2) return { points, deltaE6: null, bps: null };
  const deltaE6 = last.totalE6 - first.totalE6;
  return { points, deltaE6, bps: first.totalE6 === 0n ? null : Number((deltaE6 * 10_000n) / first.totalE6) };
}

export interface DeskView {
  wire: DeskViewWire;
  isOwner: boolean;
  exists: boolean;
  isLive: boolean;
  mode: DeskViewWire["desk"] extends infer D ? (D extends { mode: infer M } ? M : never) : never;
  state: NonNullable<DeskViewWire["desk"]>["state"];
  stateText: string;
  eyebrow: string;
  mandate: DeskMandate | null;
  plate: { totalE6: bigint | null; sinceE6: bigint | null; cashE6: bigint; valuedAtSec: number | null; timing: { bps: number; graded: number } };
  nextCheck: { atSec: number; fraction: number; lastAtSec: number | null; late: boolean };
  practice: { done: number; needed: number; opened: boolean; ready: boolean };
  holdings: HoldingRow[];
  series: SeriesPoint[];
  limits: { spentTodayE6: bigint; dailyCapE6: bigint; perActionE6: bigint; maxPremiumBps: number; lossStopBps: number; largeActionE6: bigint };
  approvals: { open: ApprovalWire[]; expired: ApprovalWire[] };
}

const big = (s: string | null | undefined): bigint | null => (s === null || s === undefined ? null : BigInt(s));
/** A price older than this is stale for the flags; the program refuses older than 15 minutes. */
const STALE_AFTER_SEC = 900;

const historyOf = (w: DeskViewWire, symbol: string): bigint[] => w.series.flatMap((p) => (p.prices[symbol] ? [BigInt(p.prices[symbol])] : []));

function holdingRow(h: SnapshotHoldingWire, mandate: DeskMandate | null, w: DeskViewWire): HoldingRow {
  const F = DESK.page.holdings;
  const flags: string[] = [];
  if (h.paused) flags.push(F.flags.paused);
  if (h.frozen) flags.push(F.flags.frozen);
  if (h.priceAgeSec !== null && h.priceAgeSec > STALE_AFTER_SEC) flags.push(F.flags.stale);
  if (mandate && h.premiumBps !== null && h.premiumBps > mandate.maxPremiumBps) flags.push(F.flags.premium(pct(h.premiumBps), pct(mandate.maxPremiumBps)));
  const threshold = mandate ? thresholdBps(mandate) : 0;
  const standing = Math.abs(h.driftBps) <= Math.max(threshold, 50) / 5 ? F.inLine : h.driftBps > 0 ? F.over(pct(h.driftBps)) : F.under(pct(h.driftBps));
  return { symbol: h.symbol, name: nameOf(h.symbol), raw: BigInt(h.raw), valueE6: big(h.valueE6), weightBps: h.weightBps, targetBps: h.targetBps, driftBps: h.driftBps, premiumBps: h.premiumBps, standing, flags, priceHistoryE8: historyOf(w, h.symbol) };
}

/** Holdings when no snapshot exists yet: the paper ledger's positions (practice) or the chain's balances (live), unvalued. */
function unvaluedRows(w: DeskViewWire, mandate: DeskMandate | null): HoldingRow[] {
  const targets = new Map(mandate?.targets.tokens.map((t) => [t.symbol, t.weightBps]) ?? []);
  const entries: Array<[PreIpoSymbol, bigint]> = w.chain
    ? w.chain.tokens.flatMap((t) => (t.symbol && BigInt(t.raw) > 0n ? [[t.symbol, BigInt(t.raw)] as [PreIpoSymbol, bigint]] : []))
    : Object.entries(w.paper?.positions ?? {}).map(([s, raw]) => [s as PreIpoSymbol, BigInt(raw)]);
  return entries.map(([symbol, raw]) => ({ symbol, name: nameOf(symbol), raw, valueE6: null, weightBps: 0, targetBps: targets.get(symbol) ?? 0, driftBps: 0, premiumBps: null, standing: DESK.page.holdings.inLine, flags: [], priceHistoryE8: historyOf(w, symbol) }));
}

export function deskView(w: DeskViewWire): DeskView {
  const desk = w.desk;
  const isOwner = w.viewer === "owner";
  const isLive = desk?.address !== null && desk?.address !== undefined;
  const mode = desk?.mode ?? "practice";
  const state = desk?.state ?? "practice";
  let mandate: DeskMandate | null = null;
  try {
    mandate = w.mandate ? mandateFromWire(w.mandate.body) : null;
  } catch {
    mandate = null;
  }
  const nowSec = w.nowSec;
  const lastAtSec = w.latest?.decidedAtSec ?? null;
  const atSec = nextTopOfHour(nowSec);
  const snapshot = w.snapshot;
  const cashE6 = snapshot ? BigInt(snapshot.cashE6) : w.chain ? BigInt(w.chain.usdcRaw) : w.paper ? BigInt(w.paper.cashE6) : 0n;
  const totalE6 = snapshot ? BigInt(snapshot.totalE6) : null;
  const baseline = big(snapshot?.baselineE6);
  const done = desk?.practiceChecks ?? 0;
  const opened = (desk?.recordOpenedAtSec ?? null) !== null;
  const eyebrow = isOwner ? (isLive ? DESK.eyebrow.live : DESK.eyebrow.practice) : isLive ? DESK.eyebrow.visitorLive : DESK.eyebrow.visitorPractice;
  const stateText = isLive ? deskCopy.deskState[state === "closed" ? "needs_attention" : state] : DESK.state[state];
  return {
    wire: w,
    isOwner,
    exists: desk !== null,
    isLive,
    mode,
    state,
    stateText: state === "closed" ? DESK.state.closed : stateText,
    eyebrow,
    mandate,
    plate: { totalE6, sinceE6: totalE6 !== null && baseline !== null ? totalE6 - baseline : null, cashE6, valuedAtSec: snapshot?.atSec ?? null, timing: w.timing },
    nextCheck: { atSec, fraction: Math.max(0, Math.min(1, (atSec - nowSec) / CHECK_EVERY_SEC)), lastAtSec, late: state === "active" && lastAtSec !== null && nowSec - lastAtSec > LATE_AFTER_SEC },
    practice: { done, needed: GO_LIVE_CHECKS, opened, ready: done >= GO_LIVE_CHECKS && opened },
    holdings: snapshot ? snapshot.holdings.map((h) => holdingRow(h, mandate, w)) : unvaluedRows(w, mandate),
    series: w.series.map((p) => ({ atSec: p.atSec, totalE6: BigInt(p.totalE6) })),
    limits: {
      spentTodayE6: w.chain ? BigInt(w.chain.spentInWindowE6) : 0n,
      dailyCapE6: w.chain ? BigInt(w.chain.dailyCapE6) : (mandate?.dailyCapE6 ?? 0n),
      perActionE6: w.chain ? BigInt(w.chain.perActionCapE6) : (mandate?.perActionCapE6 ?? 0n),
      maxPremiumBps: w.chain?.maxPremiumBps ?? mandate?.maxPremiumBps ?? 0,
      lossStopBps: mandate?.lossStopBps ?? 0,
      largeActionE6: mandate?.largeActionE6 ?? 0n,
    },
    approvals: { open: w.approvals.filter((a) => a.status === "open" && a.expiresAtSec > nowSec), expired: w.approvals.filter((a) => a.status === "expired" || (a.status === "open" && a.expiresAtSec <= nowSec)) },
  };
}
