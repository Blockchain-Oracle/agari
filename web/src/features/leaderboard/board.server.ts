import type { TickerSymbol } from "@agari/core/market";
import type { TraderRanking } from "@agari/core/projection";
import { ensureMarkets, notDeployedReading, readVenueBoard, readVenueStatic, unwrap, type VenueBoard } from "@agari/markets";
import { unstable_cache } from "next/cache";
import { webEnv } from "@/lib/env";
import type { BoardPeriod, BoardSliceWire, LeaderboardPayload } from "./protocol";
import { latestSession, type BoardSession } from "./session.server";

/**
 * The board, served: one venue-wide replay per few minutes per period, shared by every reader — server-side,
 * persisted in Next's Data Cache, no database and no credential. Expired snapshots remain available while the
 * framework refreshes them; a cold function instance can reuse the board. The route slices one ticker out of the
 * cached scan, so a ticker tab never pays for a scan of its own.
 *
 * `24h` is the reference's day: fills from two days back, so every Window that expired today has its whole life in
 * hand. `session` is the latest NYSE session that has opened, `[open, close + 15 min)` (the last Windows settle after
 * the bell), with an hour of lookback (the longest cadence). Both end at the time of the scan.
 */
const DAY_MS = 86_400_000;
const LOOKBACK_MS = 2 * DAY_MS;
const LONGEST_CADENCE_SEC = 3_600;
const SETTLE_TAIL_SEC = 900;
const TOP = 50;

/** The cached scan: the venue's payload plus every ticker's slice. */
export interface BoardCache {
  payload: LeaderboardPayload;
  byTicker: Partial<Record<TickerSymbol, BoardSliceWire>>;
}

const inFlight = new Map<BoardPeriod, Promise<BoardCache>>();

/**
 * Who is not a trader. The seed maker and settler crank are wallets, so they are listed per deployment
 * (Q-S5-2, server-only). The program seats are read from the venue's own config instead: the Trading Balance
 * vault books every tap and every runner fill under one pooled seat, and the maker vault quotes from another, so
 * the day either traded it topped the board as if it were a person. A list somebody has to remember to extend
 * was how that happened.
 */
async function operatorWallets(): Promise<string[]> {
  const listed = (process.env.AGARI_OPERATOR_WALLETS ?? "").split(",").map((w) => w.trim()).filter(Boolean);
  const seats = await readVenueStatic().then((venue) => venue.programSeats as string[]).catch(() => []);
  return [...new Set([...listed, ...seats])];
}

const rankingsWire = (rankings: readonly TraderRanking[]) => rankings.map((r) => ({ ...r, pnlBase: r.pnlBase.toString(), volumeBase: r.volumeBase.toString() }));

function serialize(board: VenueBoard, period: BoardPeriod, session: BoardSession | null, computedAtMs: number): BoardCache {
  const { traction } = board;
  const byTicker: BoardCache["byTicker"] = {};
  for (const [symbol, slice] of Object.entries(board.byTicker) as [TickerSymbol, NonNullable<VenueBoard["byTicker"][TickerSymbol]>][]) {
    byTicker[symbol] = { ...slice, rankings: rankingsWire(slice.rankings), totalVolumeBase: slice.totalVolumeBase.toString() };
  }
  const payload: LeaderboardPayload = {
    rankings: rankingsWire(board.rankings),
    traction: {
      ...traction,
      stakedBase: traction.stakedBase.toString(),
      recent: traction.recent.map((event) => ({ ...event, stakeBase: event.stakeBase.toString() })),
    },
    meta: {
      period,
      ticker: null,
      session,
      windowStartMs: board.windowStartMs,
      windowEndMs: board.windowEndMs,
      computedAtMs,
      rankedTraders: board.rankedTraders,
      totalWallets: board.totalWallets,
      closedCalls: board.closedCalls,
      totalVolumeBase: board.rankings.reduce((sum, r) => sum + r.volumeBase, 0n).toString(),
      complete: board.complete,
      decimals: board.decimals,
      symbol: board.symbol,
    },
  };
  return { payload, byTicker };
}

async function compute(period: BoardPeriod, nowMs: number): Promise<BoardCache> {
  // The deployment's env (`parseMarketsEnv()` with no input is devnet defaults only, with no venue).
  const env = webEnv.markets;
  ensureMarkets(env);
  // No venue until agari-events is deployed and configured: the board says so instead of ranking nothing.
  if (!env.venueId) return unwrap(notDeployedReading("no Agari venue configured yet"));
  const operators = await operatorWallets();
  if (period === "24h") {
    const board = unwrap(
      await readVenueBoard({ venueId: env.venueId, windowStartMs: nowMs - DAY_MS, windowEndMs: nowMs, lookbackSec: Math.floor((nowMs - LOOKBACK_MS) / 1000), top: TOP, operators }),
    );
    return serialize(board, period, null, nowMs);
  }
  const session = await latestSession(env.priceFeedUrl, Math.floor(nowMs / 1000));
  const endMs = Math.min(nowMs, (session.closeSec + SETTLE_TAIL_SEC) * 1000);
  const board = unwrap(
    await readVenueBoard({ venueId: env.venueId, windowStartMs: session.openSec * 1000, windowEndMs: endMs, lookbackSec: session.openSec - LONGEST_CADENCE_SEC, top: TOP, operators }),
  );
  return serialize(board, period, session, nowMs);
}

/** One compute per period at a time, however many readers arrive while it runs. */
function computeBoard(period: BoardPeriod): Promise<BoardCache> {
  let running = inFlight.get(period);
  if (!running) {
    running = compute(period, Date.now()).finally(() => inFlight.delete(period));
    inFlight.set(period, running);
  }
  return running;
}

/** Key by the deployment's data source and the period, never by a per-request timestamp. */
export function readBoard(period: BoardPeriod): Promise<BoardCache> {
  const { cluster, venueId, indexerUrl } = webEnv.markets;
  return unstable_cache(() => computeBoard(period), ["agari-venue-board-v4", cluster, venueId ?? "no-venue", indexerUrl ?? "no-indexer", period], { revalidate: 180 })();
}

/** The venue's board, or one ticker's slice of it; a ticker with no closed rounds is an empty board, not an error. */
export function boardView({ payload, byTicker }: BoardCache, ticker: TickerSymbol | null): LeaderboardPayload {
  if (ticker === null) return payload;
  const slice = byTicker[ticker] ?? { rankings: [], rankedTraders: 0, totalWallets: 0, closedCalls: 0, totalVolumeBase: "0" };
  return {
    ...payload,
    rankings: slice.rankings,
    meta: { ...payload.meta, ticker, rankedTraders: slice.rankedTraders, totalWallets: slice.totalWallets, closedCalls: slice.closedCalls, totalVolumeBase: slice.totalVolumeBase },
  };
}
