// recount: the board and traction recomputed from a tape of facts. Independent of `packages/markets/src/provider/**`;
// it shares only core's settlement rule (buildLedgers → settleRound → rankTraders) and applies proof-analytics.md
// §2.3's scope and attribution rules with its own mapping.

import { buildLedgers, ledgerHasActivity, rankTraders, settleRound, type LedgerFill, type LedgerSetAction, type LedgerSide, type RoundMarket, type SettledRound, type TraderRanking } from "@agari/core/projection";
import type { Address, MarketId, Signature } from "@agari/core/types";
import type { FillFact, SeriesGrid, Tape, WindowFact } from "./facts";

export interface Scope {
  windowStartMs: number;
  windowEndMs: number;
  lookbackSec: number;
  top: number;
  decimals: number;
  operators: ReadonlySet<string>;
}

export interface RecountSlice {
  rankings: TraderRanking[];
  rankedTraders: number;
  totalWallets: number;
  closedCalls: number;
  totalVolumeBase: bigint;
}

export interface RecountTraction {
  wallets: number;
  calls: number;
  cashOuts: number;
  stakedBase: bigint;
  windows: number;
  settledWindows: number;
}

export interface Recount {
  venue: RecountSlice;
  byTicker: Map<string, RecountSlice>;
  traction: RecountTraction;
  counts: { windows: number; fills: number; sets: number; wallets: number };
}

const SIDE: Record<number, LedgerSide> = { 0: "BUY_YES", 1: "SELL_YES", 2: "BUY_NO", 3: "SELL_NO" };
const PAIR_TICKS = 1_000n;

interface Scoped {
  window: WindowFact;
  grid: SeriesGrid & { symbol: string };
}

/** Settled as the board saw it: resolved before the scan ended (the board's window ends at its compute time). */
const settledBy = (w: WindowFact, endMs: number) => w.resolved !== null && w.resolved.resolvedTsSec * 1000 < endMs;

function scopedWindows(tape: Tape, scope: Scope): Map<string, Scoped> {
  const out = new Map<string, Scoped>();
  for (const w of tape.windows.values()) {
    const grid = tape.grids.get(w.series);
    if (w.tradingStartSec < 0 || !grid || grid.symbol === null || w.tradingStartSec < scope.lookbackSec) continue;
    const resolvedMs = w.resolved ? w.resolved.resolvedTsSec * 1000 : null;
    const closesInWindow = w.expirySec * 1000 >= scope.windowStartMs || (resolvedMs !== null && resolvedMs >= scope.windowStartMs && resolvedMs < scope.windowEndMs);
    if (closesInWindow) out.set(w.market, { window: w, grid: { ...grid, symbol: grid.symbol } });
  }
  return out;
}

function ledgerFill(fill: FillFact, kind: number, grid: SeriesGrid): LedgerFill {
  return {
    marketId: fill.market as MarketId,
    side: SIDE[kind]!,
    quantityRaw: fill.lots * grid.lotBase,
    yesPriceRaw: BigInt(fill.priceTicks) * grid.tickBase,
    atMs: fill.tsSec * 1000,
    txHash: fill.signature as Signature,
  };
}

function slice(byWallet: ReadonlyMap<Address, SettledRound[]>, scope: Scope): RecountSlice {
  const { rankings, closedCalls, totalWallets } = rankTraders(byWallet, scope);
  const top = rankings.slice(0, scope.top);
  return { rankings: top, rankedTraders: rankings.length, totalWallets, closedCalls, totalVolumeBase: top.reduce((sum, r) => sum + r.volumeBase, 0n) };
}

export function replay(tape: Tape, scope: Scope): Recount {
  const windows = scopedWindows(tape, scope);
  const endSec = Math.ceil(scope.windowEndMs / 1000);
  const fills = tape.fills
    .filter((f) => windows.has(f.market) && f.tsSec >= scope.lookbackSec && f.tsSec < endSec)
    .sort((a, b) => a.tsSec - b.tsSec || (a.market < b.market ? -1 : a.market > b.market ? 1 : 0) || Number(a.seq - b.seq) || a.fillIx - b.fillIx);
  const sets = tape.sets
    .filter((s) => windows.has(s.market) && s.blockTimeSec >= scope.lookbackSec && s.blockTimeSec < endSec)
    .sort((a, b) => a.blockTimeSec - b.blockTimeSec || (a.market < b.market ? -1 : a.market > b.market ? 1 : 0) || Number(a.seq - b.seq));

  const own = new Map<string, { fills: LedgerFill[]; sets: LedgerSetAction[] }>();
  const entry = (wallet: string) => own.get(wallet) ?? own.set(wallet, { fills: [], sets: [] }).get(wallet)!;
  for (const f of fills) {
    const grid = windows.get(f.market)!.grid;
    if (!scope.operators.has(f.taker)) entry(f.taker).fills.push(ledgerFill(f, f.takerKind, grid));
    if (f.maker !== f.taker && !scope.operators.has(f.maker)) entry(f.maker).fills.push(ledgerFill(f, f.makerKind, grid));
  }
  for (const s of sets) {
    const mine = own.get(s.owner);
    if (!mine) continue;
    const grid = windows.get(s.market)!.grid;
    mine.sets.push({ marketId: s.market as MarketId, kind: s.minted ? "mint" : "merge", amountRaw: s.lots * grid.lotBase, atMs: s.blockTimeSec * 1000, txHash: s.signature as Signature });
  }

  const byWallet = new Map<Address, SettledRound[]>();
  for (const [wallet, tapeOf] of own) {
    const rounds: SettledRound[] = [];
    for (const [id, ledger] of buildLedgers(tapeOf.fills, tapeOf.sets, scope.decimals)) {
      const scoped = windows.get(id);
      if (!scoped || !ledgerHasActivity(ledger)) continue;
      const w = scoped.window;
      const market: RoundMarket = {
        marketId: id,
        asset: scoped.grid.symbol,
        intervalSec: scoped.grid.cadenceSec,
        expirySec: w.expirySec,
        decimals: scope.decimals,
        settled: w.resolved !== null,
        voided: w.resolved?.voided ?? false,
        winningOutcome: w.resolved && !w.resolved.voided && (w.resolved.winner === 0 || w.resolved.winner === 1) ? (w.resolved.winner as 0 | 1) : null,
        resolvedAtMs: w.resolved ? w.resolved.resolvedTsSec * 1000 : null,
      };
      const round = settleRound({ ledger, market, feeBps: 0, liveHoldings: null });
      if (round) rounds.push(round);
    }
    if (rounds.length > 0) byWallet.set(wallet as Address, rounds);
  }

  const byTicker = new Map<string, RecountSlice>();
  for (const symbol of new Set([...windows.values()].map((w) => w.grid.symbol))) {
    const mine = new Map<Address, SettledRound[]>();
    for (const [wallet, rounds] of byWallet) {
      const picked = rounds.filter((r) => r.asset === symbol);
      if (picked.length > 0) mine.set(wallet, picked);
    }
    if (mine.size > 0) byTicker.set(symbol, slice(mine, scope));
  }
  return { venue: slice(byWallet, scope), byTicker, traction: traction(fills, windows, scope), counts: { windows: windows.size, fills: fills.length, sets: sets.length, wallets: own.size } };
}

function traction(fills: readonly FillFact[], windows: ReadonlyMap<string, Scoped>, scope: Scope): RecountTraction {
  const one = 10n ** BigInt(scope.decimals);
  const orders = new Map<string, { wallet: string; call: boolean; stakeBase: bigint }>();
  for (const f of fills) {
    const atMs = f.tsSec * 1000;
    if (atMs < scope.windowStartMs || atMs >= scope.windowEndMs || scope.operators.has(f.taker)) continue;
    const { grid } = windows.get(f.market)!;
    const buy = f.takerKind === 0 || f.takerKind === 2;
    const legTicks = f.takerKind === 0 || f.takerKind === 1 ? BigInt(f.priceTicks) : PAIR_TICKS - BigInt(f.priceTicks);
    const stakeBase = buy ? (f.lots * grid.lotBase * legTicks * grid.tickBase) / one : 0n;
    const id = `${f.signature}:${f.taker}`;
    const seen = orders.get(id);
    orders.set(id, { wallet: f.taker, call: buy, stakeBase: (seen?.stakeBase ?? 0n) + stakeBase });
  }
  const calls = [...orders.values()].filter((o) => o.call);
  let windowsInWindow = 0;
  let settledWindows = 0;
  for (const { window: w } of windows.values()) {
    if (w.expirySec * 1000 < scope.windowStartMs || w.expirySec * 1000 >= scope.windowEndMs) continue;
    windowsInWindow += 1;
    if (settledBy(w, scope.windowEndMs)) settledWindows += 1;
  }
  return {
    wallets: new Set(calls.map((c) => c.wallet)).size,
    calls: calls.length,
    cashOuts: orders.size - calls.length,
    stakedBase: calls.reduce((sum, c) => sum + c.stakeBase, 0n),
    windows: windowsInWindow,
    settledWindows,
  };
}
