/**
 * Traction off the same tape the board ranks (Masayume `provider/traction.ts:62-151`, onto `FillRow`). A call is a
 * taker's buy on a Window's Book; a taker's sell is a cash-out, listed but never counted as a call. The taker and its
 * side come straight from the chain's fill record, so a fill is unattributed only when its Window's grid is unknown.
 */
import type { TickerSymbol } from "@agari/core/market";
import type { Address, MarketId, Signature } from "@agari/core/types";
import { big, sec, type FillRow, type MarketRow } from "./index-api";
import type { TractionCall, TractionPoint, VenueTraction } from "./tape";

interface TractionWindow {
  windowStartMs: number;
  windowEndMs: number;
}

const HOUR_MS = 3_600_000;
const RECENT = 30;
/** A YES tick and its NO complement sum to 1,000 (engine §1; `schema-index.ts:163`). */
const PAIR_TICKS = 1_000n;

function attribute(fill: FillRow, row: MarketRow | undefined, one: bigint): TractionCall | null {
  if (!row || row.symbol === null || row.lot_base === null || row.tick_base === null || fill.taker_kind < 0 || fill.taker_kind > 3) return null;
  const isBuy = fill.taker_kind === 0 || fill.taker_kind === 2;
  const isUp = fill.taker_kind === 0 || fill.taker_kind === 1;
  const ticks = BigInt(fill.price_ticks);
  // Stake per fill: lots × lot_base × leg ticks × tick_base / 10^decimals; the DOWN leg pays the complement.
  const legTicks = isUp ? ticks : PAIR_TICKS - ticks;
  return {
    id: `${fill.signature}:${fill.taker}`,
    wallet: fill.taker as Address,
    kind: isBuy ? "call" : "cash-out",
    side: isUp ? "up" : "down",
    asset: row.symbol as TickerSymbol,
    marketId: fill.market as MarketId,
    stakeBase: isBuy ? (big(fill.lots) * big(row.lot_base) * legTicks * big(row.tick_base)) / one : 0n,
    txHash: fill.signature as Signature,
    atMs: sec(fill.ts_sec) * 1000,
  };
}

/** Cumulative distinct callers at each hour boundary, from the first call's hour to the window's end. */
function growthCurve(calls: readonly TractionCall[], window: TractionWindow): TractionPoint[] {
  if (calls.length === 0) return [];
  const sorted = [...calls].sort((a, b) => a.atMs - b.atMs);
  const seen = new Set<string>();
  const points: TractionPoint[] = [];
  let i = 0;
  const firstHour = window.windowStartMs + Math.floor((sorted[0]!.atMs - window.windowStartMs) / HOUR_MS) * HOUR_MS;
  for (let edge = firstHour + HOUR_MS; edge <= window.windowEndMs + HOUR_MS; edge += HOUR_MS) {
    while (i < sorted.length && sorted[i]!.atMs < edge) {
      seen.add(sorted[i]!.wallet);
      i += 1;
    }
    points.push({ atMs: Math.min(edge, window.windowEndMs), cumulative: seen.size });
    if (edge >= window.windowEndMs) break;
  }
  return points;
}

/** A taker order filling across several levels is several fill rows in one transaction: one call, stake summed. */
function byOrder(fills: readonly TractionCall[]): TractionCall[] {
  const orders = new Map<string, TractionCall>();
  for (const fill of fills) {
    const seen = orders.get(fill.id);
    if (seen) orders.set(fill.id, { ...seen, stakeBase: seen.stakeBase + fill.stakeBase, atMs: Math.min(seen.atMs, fill.atMs) });
    else orders.set(fill.id, fill);
  }
  return [...orders.values()];
}

/** Operator takers (Q-S5-2) are neither calls nor unattributed: the venue's own crank is not demand. */
export function deriveTraction(
  fills: readonly FillRow[],
  rowById: ReadonlyMap<string, MarketRow>,
  window: TractionWindow,
  decimals: number,
  operators: ReadonlySet<string>,
): VenueTraction {
  const one = 10n ** BigInt(decimals);
  const attributed: TractionCall[] = [];
  let unattributed = 0;
  for (const fill of fills) {
    const atMs = sec(fill.ts_sec) * 1000;
    if (atMs < window.windowStartMs || atMs >= window.windowEndMs || operators.has(fill.taker)) continue;
    const call = attribute(fill, rowById.get(fill.market), one);
    if (call) attributed.push(call);
    else unattributed += 1;
  }
  const events = byOrder(attributed);
  const calls = events.filter((event) => event.kind === "call");
  const wallets = new Set(calls.map((call) => call.wallet));

  let windows = 0;
  let settledWindows = 0;
  for (const row of rowById.values()) {
    const expiryMs = sec(row.expiry_sec) * 1000;
    if (expiryMs < window.windowStartMs || expiryMs >= window.windowEndMs) continue;
    windows += 1;
    if (row.state !== "open") settledWindows += 1;
  }

  return {
    wallets: wallets.size,
    calls: calls.length,
    cashOuts: events.length - calls.length,
    stakedBase: calls.reduce((sum, call) => sum + call.stakeBase, 0n),
    unattributed,
    windows,
    settledWindows,
    curve: growthCurve(calls, window),
    recent: [...events].sort((a, b) => b.atMs - a.atMs).slice(0, RECENT),
  };
}
