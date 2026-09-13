import type { ParlayQuote, ParlayReserveState } from "@masayume/core/parlay";
import { err, ok, type Reading } from "@masayume/core/schemas";
import { diagnosis, toMarketId, type Address, type EventMarket, type MarketId } from "@masayume/core/types";
import type { DraftLeg } from "@/features/parlay/LegRow";
import type { ParlayTicketView } from "@/features/parlay";

// Canned readings; nothing here is a real ticket, address or deployment.
const DECIMALS = 6;
const UNIT = 10n ** BigInt(DECIMALS);
export const FIXTURE_SYMBOL = "tUSDC";
export const FIXTURE_NOW_MS = Date.UTC(2026, 8, 2, 10, 0, 0);
const NOW_SEC = Math.floor(FIXTURE_NOW_MS / 1000);
export const FIXTURE_OWNER = "0x000000000000000000000000000000000000d357" as Address;

const id = (n: number): MarketId => toMarketId(`0x${n.toString(16).padStart(64, "0")}`);
export const MARKET_A = id(0x11a01);
export const MARKET_B = id(0x11a02);
export const MARKET_C = id(0x11a03);

export const RESERVE: ParlayReserveState = {
  deployment: { chainId: 50312, parlayReserve: "0x00000000000000000000000000000000000000c7" as Address, fromBlock: 477_800_000n },
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

function market(marketId: MarketId, asset: string, intervalSec: number, expirySec: number, openingRaw: bigint | null): EventMarket {
  return {
    marketId,
    venueId: null,
    asset,
    question: "",
    intervalSec,
    strikeRaw: 0n,
    isUpDown: true,
    tradingStartSec: expirySec - intervalSec,
    expirySec,
    poolAddress: "0x00000000000000000000000000000000000000p0".replace("p", "0") as Address,
    marketAddress: "0x00000000000000000000000000000000000000a0" as Address,
    nonce: null,
    yesTokenId: 1n,
    noTokenId: 2n,
    collateral: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E" as Address,
    decimals: DECIMALS,
    status: "Trading",
    winningOutcome: null,
    voided: false,
    finalized: null,
    openingPriceRaw: openingRaw,
    oracleQuestionId: null,
    volumeQuoteRaw: 0n,
    tradeCount: 0,
    lastPriceRaw: null,
    resolvedAtMs: null,
  };
}

export const WINDOWS: EventMarket[] = [
  market(MARKET_A, "BTC", 300, NOW_SEC + 240, 97_412_50n),
  market(MARKET_B, "ETH", 900, NOW_SEC + 780, 3_812_04n),
  market(MARKET_C, "BTC", 900, NOW_SEC + 780, null),
];
export const WINDOW_BY_ID = new Map(WINDOWS.map((w) => [w.marketId, w]));

export const LEGS: DraftLeg[] = [
  { key: "a", marketId: MARKET_A, asset: "BTC", intervalSec: 300, side: "up" },
  { key: "b", marketId: MARKET_B, asset: "ETH", intervalSec: 900, side: "down" },
];
export const LEGS_CORRELATED: DraftLeg[] = [
  { key: "a", marketId: MARKET_A, asset: "BTC", intervalSec: 300, side: "up" },
  { key: "b", marketId: MARKET_B, asset: "ETH", intervalSec: 900, side: "down" },
  { key: "c", marketId: MARKET_C, asset: "BTC", intervalSec: 900, side: "up" },
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
        asset: w?.asset ?? "BTC",
        intervalSec: w?.intervalSec ?? 300,
        openingPriceRaw: w?.openingPriceRaw ?? 97_412_50n,
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
