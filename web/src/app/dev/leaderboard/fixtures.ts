import type { TickerSymbol } from "@agari/core/market";
import { oneUnit } from "@agari/core/units";
import { diagnosis, err, ok, stale, type Reading } from "@agari/core";
import type { BoardData, BoardQuery, BoardRanking } from "@/features/leaderboard";
import { DECIMALS, FIXED_NOW_MS, FIXED_NOW_SEC, SYMBOL } from "../states/fixtures";
import type { TractionData } from "@/features/stats";
import { fixtureAddress, fixtureMarketId, fixtureSignature } from "../fixture-ids";

const ONE = oneUnit(DECIMALS);
/** A full-width 32-byte key per trader (a small number would base58 to a run of 1s). */
const owner = (n: number) => fixtureAddress((0x9e3779b97f4a7c15f39cc0605cedc8341082276bf3a27251f86c6a11d0c18e95n * BigInt(n + 1)) % 2n ** 256n);

/** A canned field of `count` traders, best first: profit falls off, a few end in the red. */
function rankings(count: number, seed: number): BoardRanking[] {
  return Array.from({ length: count }, (_, i) => {
    const pnl = BigInt(180 - i * 9 + (seed % 7)) * ONE + BigInt((i * 137_000) % 900_000);
    const volume = BigInt(420 - i * 6 + seed) * ONE;
    return {
      owner: owner(seed * 1_000 + i),
      pnlBase: pnl,
      roiBps: Number((pnl * 10_000n) / volume),
      winRatePct: Math.max(12, 78 - i * 2),
      tradeCount: Math.max(2, 44 - i),
      settledTrades: Math.max(2, 40 - i),
      bestStreak: Math.max(1, 7 - Math.floor(i / 4)),
      volumeBase: volume,
    };
  });
}

/** Today's session, 14:35 ET into it: open 09:30 ET (13:30Z), the scan ends at the fixed clock. */
const SESSION_TODAY = { date: "2026-09-01", openSec: FIXED_NOW_SEC - 3_900, closeSec: FIXED_NOW_SEC - 3_900 + 23_400 };
const SESSION_PREVIOUS = { date: "2026-08-31", openSec: FIXED_NOW_SEC - 90_300, closeSec: FIXED_NOW_SEC - 90_300 + 23_400 };

function board(query: BoardQuery, count: number, seed: number, session: typeof SESSION_TODAY | null, endMs = FIXED_NOW_MS): BoardData {
  const rows = rankings(count, seed);
  return {
    rankings: rows,
    meta: {
      period: query.period,
      ticker: query.ticker,
      session,
      windowStartMs: session ? session.openSec * 1000 : FIXED_NOW_MS - 86_400_000,
      windowEndMs: endMs,
      computedAtMs: FIXED_NOW_MS,
      rankedTraders: count,
      totalWallets: count,
      closedCalls: rows.reduce((sum, r) => sum + r.tradeCount, 0),
      totalVolumeBase: rows.reduce((sum, r) => sum + r.volumeBase, 0n),
      complete: true,
      decimals: DECIMALS,
      symbol: SYMBOL,
    },
  };
}

const TICKER_FIELD: Partial<Record<TickerSymbol, number>> = { TSLA: 11, NVDA: 7, AAPL: 3, QQQ: 1 };

/** What `/api/leaderboard` would answer for each tab: a full venue board, and thinner per-ticker slices. */
export function boardFor(query: BoardQuery): Reading<BoardData> {
  const seed = query.ticker ? query.ticker.charCodeAt(0) : 1;
  const count = query.ticker ? (TICKER_FIELD[query.ticker] ?? 0) : query.period === "24h" ? 50 : 26;
  return ok(board(query, count, seed, query.period === "session" ? SESSION_TODAY : null), FIXED_NOW_MS);
}

/** Before today's open the session board is the previous session's, labelled with its date (Q-S5-4). */
export const PREVIOUS_SESSION: Reading<BoardData> = ok(board({ period: "session", ticker: null }, 5, 3, SESSION_PREVIOUS, (SESSION_PREVIOUS.closeSec + 900) * 1000), FIXED_NOW_MS);
export const PARTIAL_DAY: Reading<BoardData> = stale(ok({ ...board({ period: "24h", ticker: null }, 4, 9, null), meta: { ...board({ period: "24h", ticker: null }, 4, 9, null).meta, complete: false } }, FIXED_NOW_MS - 240_000), "refresh-failed");
export const EMPTY_SLICE: Reading<BoardData> = ok(board({ period: "session", ticker: "MSFT" }, 0, 0, SESSION_TODAY), FIXED_NOW_MS);
export const FAILED: Reading<BoardData> = err(diagnosis("indexer-down", "Leaderboard request failed or timed out"));
export const NEXT_EXPIRY_SEC = FIXED_NOW_SEC + 275;
export const YOU = owner(1_000 + 5);

const TAPE_ASSETS = ["TSLA", "NVDA", "AAPL", "QQQ"] as const;

/** The venue's latest fills for the Live activity section: calls, every fifth a cash-out, a few minutes apart. */
export const ACTIVITY: Reading<TractionData> = ok(
  {
    wallets: 9,
    calls: 64,
    cashOuts: 12,
    stakedBase: 128n * ONE,
    unattributed: 0,
    windows: 90,
    settledWindows: 88,
    curve: [],
    recent: Array.from({ length: 10 }, (_, i) => ({
      id: `${i}`,
      wallet: owner(i % 9),
      kind: i % 5 === 4 ? ("cash-out" as const) : ("call" as const),
      side: i % 2 === 0 ? ("up" as const) : ("down" as const),
      asset: TAPE_ASSETS[i % TAPE_ASSETS.length]!,
      marketId: fixtureMarketId(0x9100 + i),
      stakeBase: i % 5 === 4 ? 0n : BigInt(1 + (i % 3)) * ONE,
      txHash: fixtureSignature(0xabd000 + i),
      atMs: FIXED_NOW_MS - (i * 3 + 1) * 60_000,
    })),
    meta: { period: "24h", windowStartMs: FIXED_NOW_MS - 86_400_000, windowEndMs: FIXED_NOW_MS, computedAtMs: FIXED_NOW_MS - 42_000, complete: true, decimals: DECIMALS, symbol: SYMBOL },
  },
  FIXED_NOW_MS,
);
