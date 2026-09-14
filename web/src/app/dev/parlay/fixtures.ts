import type { TickerSymbol } from "@agari/core/market";
import { fixtureWindow } from "../fixture-window";
import { CLUSTER_ID } from "@agari/core/constants";
import type { ParlayQuote, ParlayReserveState } from "@agari/core/parlay";
import { err, ok, type Reading } from "@agari/core/schemas";
import { diagnosis, toMarketId, type Address, type EventMarket, type MarketId } from "@agari/core/types";
import type { DraftLeg } from "@/features/parlay/LegRow";
import type { ParlayTicketView } from "@/features/parlay";
import { fixtureAddress, fixtureMarketId, fixtureSignature } from "../fixture-ids";

// Canned readings; nothing here is a real ticket, address or deployment.
const DECIMALS = 6;
const UNIT = 10n ** BigInt(DECIMALS);
export const FIXTURE_SYMBOL = "tUSDC";
export const FIXTURE_NOW_MS = Date.UTC(2026, 8, 2, 10, 0, 0);
const NOW_SEC = Math.floor(FIXTURE_NOW_MS / 1000);
export const FIXTURE_OWNER = fixtureAddress("0x000000000000000000000000000000000000d357");

const id = (n: number): MarketId => fixtureMarketId(n);
export const MARKET_A = id(0x11a01);
export const MARKET_B = id(0x11a02);
export const MARKET_C = id(0x11a03);

export const RESERVE: ParlayReserveState = {
  deployment: { chainId: CLUSTER_ID.devnet, parlayReserve: fixtureAddress("0x00000000000000000000000000000000000000c7"), fromBlock: 477_800_000n },
  params: {
    marginBps: 1_200,
    maxExposureBps: 6_000,
    correlationBps: 4_000,
    maxLegs: 3,
    maxPayoutCapBase: 500n * UNIT,
    maxExpiryLockedBase: 1_000n * UNIT,
    minCombinedProbRaw: 20_000n,
    priceDepthRaw: 20n * UNIT,
  },
  liquidBase: 4_128n * UNIT + 400_000n,
  lockedBase: 871n * UNIT + 600_000n,
  totalValueBase: 5_000n * UNIT,
  utilizationBps: 1_743,
  supplyShares: 5_000n * UNIT,
  paused: false,
  decimals: DECIMALS,
};

function market(marketId: MarketId, asset: TickerSymbol, intervalSec: number, expirySec: number, openingRaw: bigint | null): EventMarket {
  return fixtureWindow({ marketId, asset, intervalSec, expirySec, decimals: DECIMALS, openingPriceRaw: openingRaw });
}

export const WINDOWS: EventMarket[] = [
  market(MARKET_A, "TSLA", 300, NOW_SEC + 240, 36_548_000_000n),
  market(MARKET_B, "NVDA", 900, NOW_SEC + 780, 17_822_000_000n),
  market(MARKET_C, "TSLA", 900, NOW_SEC + 780, null),
];
export const WINDOW_BY_ID = new Map(WINDOWS.map((w) => [w.marketId, w]));

export const LEGS: DraftLeg[] = [
  { key: "a", marketId: MARKET_A, asset: "TSLA", intervalSec: 300, side: "up" },
  { key: "b", marketId: MARKET_B, asset: "NVDA", intervalSec: 900, side: "down" },
];
export const LEGS_CORRELATED: DraftLeg[] = [
  { key: "a", marketId: MARKET_A, asset: "TSLA", intervalSec: 300, side: "up" },
  { key: "b", marketId: MARKET_B, asset: "NVDA", intervalSec: 900, side: "down" },
  { key: "c", marketId: MARKET_C, asset: "TSLA", intervalSec: 900, side: "up" },
];

export const QUOTE: ParlayQuote = {
  legPricesRaw: [600_000n, 420_000n],
  legProbBps: [6_000, 4_200],
  combinedProbRaw: 252_000n,
  rawCombinedProbRaw: 252_000n,
  correlated: false,
  stakeBase: 28_224_000n,
  maxPayoutBase: 100n * UNIT,
  multiplierMilli: 3_543,
  decimals: DECIMALS,
  quotedAtMs: FIXTURE_NOW_MS,
};

export const QUOTE_CORRELATED: ParlayQuote = {
  legPricesRaw: [600_000n, 420_000n, 550_000n],
  legProbBps: [6_000, 4_200, 5_500],
  combinedProbRaw: 168_000n,
  rawCombinedProbRaw: 138_600n,
  correlated: true,
  stakeBase: 18_816_000n,
  maxPayoutBase: 100n * UNIT,
  multiplierMilli: 5_314,
  decimals: DECIMALS,
  quotedAtMs: FIXTURE_NOW_MS,
};

export const QUOTE_ERROR = diagnosis("no-liquidity", "ThinBook(0x…11a02, 12000000, 100000000)", { errorName: "ThinBook" });

interface TicketSeed {
  parlayId: bigint;
  status: ParlayTicketView["status"];
  legs: Array<Pick<ParlayTicketView["legs"][number], "status" | "settledOnchain"> & { marketId: MarketId; side: "up" | "down"; expirySec: number }>;
  stake: bigint;
  payout: bigint;
}

function ticket(seed: TicketSeed): ParlayTicketView {
  const won = seed.legs.filter((l) => l.status === "won").length;
  return {
    parlayId: seed.parlayId,
    owner: FIXTURE_OWNER,
    status: seed.status,
    legCount: seed.legs.length,
    wonCount: won,
    openedAtSec: NOW_SEC - 600,
    lastExpirySec: Math.max(...seed.legs.map((l) => l.expirySec)),
    stakeBase: seed.stake,
    maxPayoutBase: seed.payout,
    houseLockedBase: seed.payout - seed.stake,
    combinedProbRaw: 252_000n,
    legs: seed.legs.map((l) => {
      const w = WINDOW_BY_ID.get(l.marketId);
      return {
        marketId: l.marketId,
        side: l.side,
        status: l.status,
        expirySec: l.expirySec,
        resolvedAtSec: l.status === "pending" ? null : l.expirySec + 20,
        priceRaw: l.side === "up" ? 600_000n : 420_000n,
        asset: w?.asset ?? "TSLA",
        intervalSec: w?.intervalSec ?? 300,
        openingPriceRaw: w?.openingPriceRaw ?? 36_548_000_000n,
        settledOnchain: l.settledOnchain,
      };
    }),
  };
}

export const TICKETS: Array<{ label: string; ticket: ParlayTicketView }> = [
  {
    label: "In play — one leg won, one pending",
    ticket: ticket({
      parlayId: 7n,
      status: "live",
      stake: 28_224_000n,
      payout: 100n * UNIT,
      legs: [
        { marketId: MARKET_A, side: "up", status: "won", settledOnchain: true, expirySec: NOW_SEC - 300 },
        { marketId: MARKET_B, side: "down", status: "pending", settledOnchain: false, expirySec: NOW_SEC + 780 },
      ],
    }),
  },
  {
    label: "In play — a settled Window waiting for its crank",
    ticket: ticket({
      parlayId: 8n,
      status: "live",
      stake: 5n * UNIT,
      payout: 18n * UNIT,
      legs: [
        { marketId: MARKET_A, side: "up", status: "pending", settledOnchain: true, expirySec: NOW_SEC - 60 },
        { marketId: MARKET_B, side: "up", status: "pending", settledOnchain: false, expirySec: NOW_SEC + 780 },
      ],
    }),
  },
  {
    label: "Won — claimable",
    ticket: ticket({
      parlayId: 5n,
      status: "won",
      stake: 10n * UNIT,
      payout: 41n * UNIT,
      legs: [
        { marketId: MARKET_A, side: "up", status: "won", settledOnchain: true, expirySec: NOW_SEC - 1_200 },
        { marketId: MARKET_B, side: "down", status: "won", settledOnchain: true, expirySec: NOW_SEC - 600 },
      ],
    }),
  },
  {
    label: "Dead — one leg missed",
    ticket: ticket({
      parlayId: 4n,
      status: "lost",
      stake: 5n * UNIT,
      payout: 20n * UNIT,
      legs: [
        { marketId: MARKET_A, side: "up", status: "won", settledOnchain: true, expirySec: NOW_SEC - 2_400 },
        { marketId: MARKET_C, side: "up", status: "lost", settledOnchain: true, expirySec: NOW_SEC - 1_800 },
      ],
    }),
  },
  {
    label: "Voided — a Window voided, stake refunded",
    ticket: ticket({
      parlayId: 3n,
      status: "void",
      stake: 5n * UNIT,
      payout: 20n * UNIT,
      legs: [
        { marketId: MARKET_A, side: "down", status: "void", settledOnchain: true, expirySec: NOW_SEC - 3_000 },
        { marketId: MARKET_B, side: "up", status: "pending", settledOnchain: true, expirySec: NOW_SEC - 2_400 },
      ],
    }),
  },
  {
    label: "Paid",
    ticket: ticket({
      parlayId: 2n,
      status: "claimed",
      stake: 8n * UNIT,
      payout: 30n * UNIT,
      legs: [
        { marketId: MARKET_A, side: "up", status: "won", settledOnchain: true, expirySec: NOW_SEC - 7_200 },
        { marketId: MARKET_B, side: "up", status: "won", settledOnchain: true, expirySec: NOW_SEC - 6_600 },
      ],
    }),
  },
];

export const RESERVE_READINGS: Array<{ label: string; reading: Reading<ParlayReserveState | null> }> = [
  { label: "Not deployed on this network", reading: ok(null, FIXTURE_NOW_MS) },
  { label: "Deployed — reserve sheet", reading: ok(RESERVE, FIXTURE_NOW_MS) },
  { label: "First read failed", reading: err(diagnosis("rpc-down", "eth_call timed out")) },
];
