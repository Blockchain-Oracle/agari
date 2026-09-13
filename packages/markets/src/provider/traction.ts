import type { LedgerFill } from "@masayume/core/projection";
import type { Address, MarketId } from "@masayume/core/types";
import type { BinaryMarket, FillRow } from "@somnia-chain/markets-sdk";
import { toLedgerFill } from "../mappers/fill";
import { toRoundMarket } from "./history";
import { SETTLED_STATUSES } from "./markets";

/**
 * Traction, derived from the same fill tape the board ranks — no sponsor ledger, no self-report.
 * A "call" is a taker's buy on a Window's book: the wallet clicked a side and the venue filled it.
 * A taker's sell is a cash-out and is listed as one, never counted as a call. Fills the indexer
 * has not yet attributed (no taker, or no side bridged) are counted as unattributed and never
 * guessed onto a wallet.
 */
export interface TractionCall {
  /** `<txHash>:<wallet>` — one taker order lands in one transaction, however many levels it fills across. */
  id: string;
  wallet: Address;
  kind: "call" | "cash-out";
  side: "up" | "down";
  asset: string;
  marketId: MarketId;
  /** What the buy put on the line; zero on a cash-out. */
  stakeBase: bigint;
  txHash: LedgerFill["txHash"];
  atMs: number;
}

export interface TractionPoint {
  atMs: number;
  cumulative: number;
}

export interface TractionWindow {
  windowStartMs: number;
  windowEndMs: number;
}

export interface VenueTraction {
  /** Distinct wallets that made at least one call inside the window. */
  wallets: number;
  /** Taker orders (one per transaction and wallet) that bought inside the window, with a bridged taker and side. */
  calls: number;
  /** Taker sells inside the window — positions cashed out on the book before the close. */
  cashOuts: number;
  /** Collateral those calls put on the line, summed. */
  stakedBase: bigint;
  /** Taker fills the indexer had not attributed at read time. */
  unattributed: number;
  /** Windows that expired inside the window, and how many the venue has settled. */
  windows: number;
  settledWindows: number;
  /** Cumulative distinct callers at the end of each hour of the window, oldest first; empty with no calls. */
  curve: TractionPoint[];
  /** The newest calls and cash-outs, newest first. */
  recent: TractionCall[];
}

const HOUR_MS = 3_600_000;
const RECENT = 30;

function attribute(fill: FillRow, rowById: ReadonlyMap<MarketId, BinaryMarket>, one: bigint): TractionCall | null {
  const taker = (fill.takerOrder?.owner ?? fill.taker ?? "").toLowerCase() as Address;
  if (!taker) return null;
  const own = toLedgerFill(taker, fill);
  if (!own) return null;
  const row = rowById.get(own.marketId);
  if (!row) return null;
  const isBuy = own.side === "BUY_YES" || own.side === "BUY_NO";
  const isUp = own.side === "BUY_YES" || own.side === "SELL_YES";
  // The book prices in YES terms; the DOWN leg pays the complement — the ledger's own rule.
  const priceRaw = isUp ? own.yesPriceRaw : one - own.yesPriceRaw;
  return {
    id: `${own.txHash}:${taker}`,
    wallet: taker,
    kind: isBuy ? "call" : "cash-out",
    side: isUp ? "up" : "down",
    asset: toRoundMarket(row).asset,
    marketId: own.marketId,
    stakeBase: isBuy ? (own.quantityRaw * priceRaw) / one : 0n,
    txHash: own.txHash,
    atMs: own.atMs,
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

/** A taker order filling across several price levels is several fill rows in one transaction; it is one call, with its stake summed. */
function byOrder(fills: readonly TractionCall[]): TractionCall[] {
  const orders = new Map<string, TractionCall>();
  for (const fill of fills) {
    const seen = orders.get(fill.id);
    if (seen) orders.set(fill.id, { ...seen, stakeBase: seen.stakeBase + fill.stakeBase, atMs: Math.min(seen.atMs, fill.atMs) });
    else orders.set(fill.id, fill);
  }
  return [...orders.values()];
}

export function deriveTraction(fills: readonly FillRow[], rowById: ReadonlyMap<MarketId, BinaryMarket>, window: TractionWindow, decimals: number): VenueTraction {
  const one = 10n ** BigInt(decimals);
  const attributed: TractionCall[] = [];
  let unattributed = 0;
  for (const fill of fills) {
    const atMs = Number(fill.timestamp) * 1000;
    if (!Number.isFinite(atMs) || atMs < window.windowStartMs || atMs >= window.windowEndMs) continue;
    const call = attribute(fill, rowById, one);
    if (call) attributed.push(call);
    else unattributed += 1;
  }
  const events = byOrder(attributed);
  const calls = events.filter((event) => event.kind === "call");
  const wallets = new Set(calls.map((call) => call.wallet));

  let windows = 0;
  let settledWindows = 0;
  for (const row of rowById.values()) {
    const expiryMs = Number(row.expiry) * 1000;
    if (expiryMs < window.windowStartMs || expiryMs >= window.windowEndMs) continue;
    windows += 1;
    if (SETTLED_STATUSES.has(row.status)) settledWindows += 1;
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
