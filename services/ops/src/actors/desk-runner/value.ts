/**
 * What the desk is worth (desk.md §8): holdings valued on the 30-minute mean of the in-process PreStocks history,
 * never on one instant, with at least three samples or the name is unpriced. Multipliers come from the mints
 * themselves (`readDeskMints`, refreshed every ten minutes): the catalogue prices a UI token, the ledger holds raw.
 * The runner never fetches PreStocks itself; it reads the feed the process already runs.
 */
import { valueDesk, type DeskHoldingInput, type DeskMandate, type DeskValuation } from "@agari/core/desk";
import { PRE_IPO_SYMBOLS, type PreIpoSymbol } from "@agari/core/market";
import { DESK_MINTS, readDeskMints } from "@agari/markets/desk";
import { errorText } from "../../runtime/env";
import type { PreStocksSample, PreStocksSpotFeed } from "../../prices/prestocks-spot";
import type { DeskStanding, MintCache, RunnerContext } from "./types";

export const MEAN_WINDOW_SEC = 30 * 60;
export const MIN_MEAN_SAMPLES = 3;
const MINTS_EVERY_SEC = 10 * 60;

/** The mean token price over the last half hour, or null with fewer than three samples in it. */
export function meanPriceE8(history: readonly PreStocksSample[], nowSec: number): bigint | null {
  const recent = history.filter((s) => s.fetchedAtSec >= nowSec - MEAN_WINDOW_SEC && s.fetchedAtSec <= nowSec);
  if (recent.length < MIN_MEAN_SAMPLES) return null;
  return recent.reduce((sum, s) => sum + s.tokenPriceE8, 0n) / BigInt(recent.length);
}

export interface PriceView {
  spotE8: bigint;
  meanE8: bigint | null;
  markE8: bigint;
  fetchedAtSec: number;
  samples: number;
}

/** The feed's view of one name now: the latest read, its half-hour mean, and how many samples the mean rests on. */
export function priceView(feed: PreStocksSpotFeed, symbol: PreIpoSymbol, nowSec: number): PriceView | null {
  const history = feed.history(symbol);
  const latest = history.at(-1);
  if (!latest) return null;
  const recent = history.filter((s) => s.fetchedAtSec >= nowSec - MEAN_WINDOW_SEC);
  return { spotE8: latest.tokenPriceE8, meanE8: meanPriceE8(history, nowSec), markE8: latest.markPriceE8, fetchedAtSec: latest.fetchedAtSec, samples: recent.length };
}

/** True once every name the mandate names has enough samples for a mean: the first wakes after boot wait for this. */
export function feedWarm(feed: PreStocksSpotFeed, symbols: readonly PreIpoSymbol[], nowSec: number): boolean {
  return symbols.every((s) => meanPriceE8(feed.history(s), nowSec) !== null);
}

/** The eight mints' multipliers and pause flags, read together and kept ten minutes; the last good read on failure. */
export async function refreshMints(ctx: RunnerContext, nowSec: number): Promise<MintCache | null> {
  if (ctx.mints && nowSec - ctx.mints.readAtSec < MINTS_EVERY_SEC) return ctx.mints;
  if (!ctx.rpc) return ctx.mints;
  try {
    const byMint = await readDeskMints(ctx.rpc, PRE_IPO_SYMBOLS.map((s) => DESK_MINTS[s]), nowSec);
    ctx.mints = { readAtSec: nowSec, byMint };
  } catch (error) {
    ctx.log(`mints not read: ${errorText(error)}${ctx.mints ? " (keeping the last read)" : ""}`);
  }
  return ctx.mints;
}

export const multiplierOf = (mints: MintCache | null, symbol: PreIpoSymbol): bigint | null => mints?.byMint[DESK_MINTS[symbol] as string]?.multiplierE12 ?? null;
export const pausedOf = (mints: MintCache | null, symbol: PreIpoSymbol): boolean | null => mints?.byMint[DESK_MINTS[symbol] as string]?.paused ?? null;

/** Every name the mandate names plus anything still held, as valuation inputs. */
export function holdingInputs(ctx: RunnerContext, standing: DeskStanding, mandate: DeskMandate, nowSec: number): DeskHoldingInput[] {
  const symbols = new Set<PreIpoSymbol>(mandate.targets.tokens.map((t) => t.symbol));
  for (const held of Object.keys(standing.positions)) if ((PRE_IPO_SYMBOLS as readonly string[]).includes(held)) symbols.add(held as PreIpoSymbol);
  return [...symbols].map((symbol) => {
    const raw = standing.positions[symbol] ?? 0n;
    const view = priceView(ctx.feed, symbol, nowSec);
    const multiplierE12 = multiplierOf(ctx.mints, symbol);
    const paused = pausedOf(ctx.mints, symbol);
    const frozen = standing.kind === "live" ? (standing.frozen[symbol] ?? false) : false;
    const why = !view ? "no PreStocks read yet" : view.meanE8 === null ? `only ${view.samples} reads in the last half hour` : multiplierE12 === null ? "the token's multiplier could not be read" : undefined;
    return {
      symbol,
      mint: DESK_MINTS[symbol] as string,
      raw,
      multiplierE12: multiplierE12 ?? 0n,
      priceE8: why ? null : (view?.meanE8 ?? null),
      spotE8: view?.spotE8 ?? null,
      markE8: view?.markE8 ?? null,
      ...(why ? { unpricedWhy: why } : {}),
      paused: paused ?? false,
      frozen,
    };
  });
}

export function valueNow(ctx: RunnerContext, standing: DeskStanding, mandate: DeskMandate, nowSec: number): DeskValuation {
  return valueDesk({ atSec: nowSec, cashE6: standing.cashE6, holdings: holdingInputs(ctx, standing, mandate, nowSec), targets: mandate.targets });
}

/** A held name that moved this far within the hour wakes the desk (plan §5.8). */
export const MOVE_WAKE_BPS = 300;

/** The largest move of any held name over the last hour of feed history, in basis points. */
export function heldMoveBps(feed: PreStocksSpotFeed, positions: Record<string, bigint>, nowSec: number): { symbol: PreIpoSymbol; bps: number } | null {
  let worst: { symbol: PreIpoSymbol; bps: number } | null = null;
  for (const symbol of Object.keys(positions) as PreIpoSymbol[]) {
    if ((positions[symbol] ?? 0n) <= 0n) continue;
    const hour = feed.history(symbol).filter((s) => s.fetchedAtSec >= nowSec - 3600);
    const first = hour[0];
    const last = hour.at(-1);
    if (!first || !last || first.tokenPriceE8 <= 0n) continue;
    const bps = Number((((last.tokenPriceE8 - first.tokenPriceE8) * 10_000n) / first.tokenPriceE8));
    if (!worst || Math.abs(bps) > Math.abs(worst.bps)) worst = { symbol, bps };
  }
  return worst;
}
