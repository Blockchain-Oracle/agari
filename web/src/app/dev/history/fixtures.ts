import { settleRound, type MarketLedger, type RoundMarket, type SettledRound } from "@masayume/core/projection";
import { toMarketId, type Address } from "@masayume/core/types";
import { oneUnit } from "@masayume/core/units";
import { ok, type Reading } from "@masayume/core";
import type { BoardData } from "@/features/leaderboard";
import { DECIMALS, FIXED_NOW_MS, TX_HASH } from "../states/fixtures";

const ONE = oneUnit(DECIMALS);
const HOUR_MS = 3_600_000;

const id = (n: number) => toMarketId(`0x${n.toString(16).padStart(64, "0")}`);

function ledger(n: number, over: Partial<MarketLedger>): MarketLedger {
  return { marketId: id(n), heldUpRaw: 10n * ONE, heldDownRaw: 0n, costBase: 4n * ONE, proceedsBase: 0n, sidesTraded: [0], fillCount: 1, shortCount: 0, firstAtMs: FIXED_NOW_MS - (n + 1) * HOUR_MS, lastAtMs: FIXED_NOW_MS - n * HOUR_MS, entryTxHash: TX_HASH, ...over };
}

function market(n: number, over: Partial<RoundMarket>): RoundMarket {
  const expirySec = Math.floor((FIXED_NOW_MS - n * HOUR_MS) / 1000);
  return { marketId: id(n), asset: "BTC", intervalSec: 300, expirySec, decimals: DECIMALS, settled: true, voided: false, winningOutcome: 0, resolvedAtMs: expirySec * 1000 + 4_000, ...over };
}

function round(n: number, l: Partial<MarketLedger>, m: Partial<RoundMarket>, live: { upRaw: bigint; downRaw: bigint } | null, feeBps = 0): SettledRound {
  const value = settleRound({ ledger: ledger(n, l), market: market(n, m), feeBps, liveHoldings: live });
  if (!value) throw new Error("fixture must settle");
  return value;
}

/** Newest first, as the reading orders them: paid win, win to collect, loss, void, closed early, short, hedge. */
export const ROUNDS: SettledRound[] = [
  round(1, {}, {}, { upRaw: 0n, downRaw: 0n }),
  round(2, { heldUpRaw: 6n * ONE, costBase: 3n * ONE }, { asset: "ETH", intervalSec: 900 }, { upRaw: 6n * ONE, downRaw: 0n }, 100),
  round(3, { heldUpRaw: 0n, heldDownRaw: 8n * ONE, costBase: 5n * ONE, sidesTraded: [1] }, {}, { upRaw: 0n, downRaw: 8n * ONE }),
  round(4, { heldDownRaw: 2n * ONE, costBase: 6n * ONE, sidesTraded: [0, 1] }, { voided: true, winningOutcome: null }, null),
  round(5, { heldUpRaw: 0n, proceedsBase: 5n * ONE }, { intervalSec: 3_600 }, null),
  round(6, { heldUpRaw: 0n, heldDownRaw: 5n * ONE, costBase: 205_000n, shortCount: 1, sidesTraded: [1] }, { winningOutcome: 1 }, { upRaw: 0n, downRaw: 0n }),
  round(7, { heldUpRaw: 4n * ONE, heldDownRaw: 10n * ONE, costBase: 7n * ONE, sidesTraded: [0, 1] }, { intervalSec: 86_400 }, { upRaw: 4n * ONE, downRaw: 0n }),
  round(8, {}, { asset: "ETH" }, { upRaw: 0n, downRaw: 0n }),
  round(9, { heldUpRaw: 0n, heldDownRaw: 3n * ONE, costBase: 2n * ONE, sidesTraded: [1] }, {}, null),
];

export const FIXTURE_ADDRESS: Address = "0x8ba1f109551bD432803012645Ac136ddd64DBA72";

const owners = ["0x93e3aaaa000000000000000000000000000059cf", "0x333c0000000000000000000000000000000d0795", "0xe1180000000000000000000000000000000daeb4", "0xfd9c00000000000000000000000000000005cd9", FIXTURE_ADDRESS, "0x428100000000000000000000000000000000cc34", "0x1111000000000000000000000000000000002222", "0x3333000000000000000000000000000000004444", "0x5555000000000000000000000000000000006666"] as const;

export const BOARD: Reading<BoardData> = ok(
  {
    rankings: owners.map((owner, i) => ({
      owner: owner as Address,
      pnlBase: (120n - BigInt(i) * 23n) * ONE,
      roiBps: 3_000 - i * 400,
      winRatePct: 71 - i * 4,
      tradeCount: 40 - i * 3,
      settledTrades: 36 - i * 3,
      bestStreak: 6 - Math.floor(i / 2),
      volumeBase: (400n - BigInt(i) * 30n) * ONE,
    })),
    meta: { period: "24h", windowStartMs: FIXED_NOW_MS - 86_400_000, windowEndMs: FIXED_NOW_MS, computedAtMs: FIXED_NOW_MS, rankedTraders: 9, totalWallets: 9, closedCalls: 231, totalVolumeBase: 2_520n * ONE, complete: true, decimals: DECIMALS, symbol: "tUSDC" },
  },
  FIXED_NOW_MS,
);
