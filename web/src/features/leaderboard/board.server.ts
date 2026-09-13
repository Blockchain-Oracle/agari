import { ensureMarkets, parseMarketsEnv, readVenueBoard, unwrap, type VenueBoard } from "@masayume/markets";
import type { LeaderboardPayload } from "./protocol";
import { unstable_cache } from "next/cache";

/**
 * The board, served: one venue-wide replay per few minutes, shared by every reader — server-side,
 * persisted in Next's Data Cache, no database and no credential. Expired snapshots remain
 * available while the framework refreshes them; a cold function instance can reuse the board.
 *
 * A day, as the reference settled on: a venue whose Windows close in minutes fills a day with
 * hundreds of rounds and a week with more pages than a request can finish. Fills are read from two
 * days back so every Window that expired today has its whole life in hand (no cadence exceeds a day).
 */
const DAY_MS = 86_400_000;
const WINDOW_MS = DAY_MS;
const LOOKBACK_MS = 2 * DAY_MS;
const TOP = 50;

let inFlight: Promise<LeaderboardPayload> | null = null;

function serialize(board: VenueBoard, computedAtMs: number): LeaderboardPayload {
  const { traction } = board;
  return {
    rankings: board.rankings.map((r) => ({ ...r, pnlBase: r.pnlBase.toString(), volumeBase: r.volumeBase.toString() })),
    traction: {
      ...traction,
      stakedBase: traction.stakedBase.toString(),
      recent: traction.recent.map((event) => ({ ...event, stakeBase: event.stakeBase.toString() })),
    },
    meta: {
      period: "24h",
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
}

async function compute(nowMs: number): Promise<LeaderboardPayload> {
  const env = parseMarketsEnv();
  ensureMarkets(env);
  const board = unwrap(
    await readVenueBoard({ venueId: env.venueId, windowStartMs: nowMs - WINDOW_MS, windowEndMs: nowMs, lookbackSec: Math.floor((nowMs - LOOKBACK_MS) / 1000), top: TOP }),
  );
  return serialize(board, nowMs);
}

async function computeBoard(): Promise<LeaderboardPayload> {
  if (!inFlight) {
    inFlight = compute(Date.now())
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** Key by the deployment's data source, never by a per-request timestamp. */
export function readBoard(): Promise<LeaderboardPayload> {
  const { chainId, venueId, indexerUrl } = parseMarketsEnv();
  return unstable_cache(computeBoard, ["masayume-venue-board-v2", String(chainId), venueId, indexerUrl], { revalidate: 180 })();
}
