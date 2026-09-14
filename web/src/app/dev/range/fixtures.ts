import { fixtureWindow } from "../fixture-window";
import { CLUSTER_ID } from "@agari/core/constants";
import { classifyRangeBand, type RangeQuote, type RangeReserveState } from "@agari/core/range";
import { diagnosis, toMarketId, type Address, type Diagnosis, type EventMarket, type MarketId } from "@agari/core/types";
import type { RangeRoundView } from "@/features/range";
import { fixtureAddress, fixtureMarketId, fixtureSignature } from "../fixture-ids";

// Canned readings; nothing here is a real round, address or deployment.
const DECIMALS = 6;
const UNIT = 10n ** BigInt(DECIMALS);
export const FIXTURE_SYMBOL = "tUSDC";
export const FIXTURE_NOW_MS = Date.UTC(2026, 8, 2, 10, 0, 0);
const NOW_SEC = Math.floor(FIXTURE_NOW_MS / 1000);
const OWNER = fixtureAddress("0x000000000000000000000000000000000000d357");
const id = (n: number): MarketId => fixtureMarketId(n);

/** 76,735.23 — the print Window 70535 settled at live (context/43). */
export const OPENING = 7_673_523n;

export const RESERVE: RangeReserveState = {
  deployment: { chainId: CLUSTER_ID.devnet, rangeReserve: fixtureAddress("0x00000000000000000000000000000000000000c8"), fromBlock: 477_900_000n },
  params: {
    marginBps: 1_200,
    maxExposureBps: 6_000,
    maxSpreadRaw: 200_000n,
    centerDepthRaw: 20n * UNIT,
    minCenterQE6: 30_000,
    maxCenterQE6: 970_000,
    minProbRaw: 20_000n,
    maxProbRaw: 970_000n,
    minTimeLeftSec: 60,
    maxHorizonSec: 172_800,
    staleAfterSec: 21_600,
    maxPayoutCapBase: 500n * UNIT,
    maxExpiryLockedBase: 1_000n * UNIT,
  },
  liquidBase: 4_676n * UNIT + 929_760n,
  lockedBase: 323n * UNIT + 70_240n,
  totalValueBase: 5_000n * UNIT,
  utilizationBps: 646,
  supplyShares: 5_000n * UNIT,
  paused: false,
  decimals: DECIMALS,
};

export const WINDOW: EventMarket = fixtureWindow({ marketId: id(0x11393), intervalSec: 300, expirySec: NOW_SEC + 240, decimals: DECIMALS, openingPriceRaw: OPENING });

/** The shared vector: ±$30 at even odds, four minutes out. */
export const QUOTE: RangeQuote = {
  side: "inside",
  insideProbE6: 315_946n,
  probRaw: 315_946n,
  stakeBase: 35_385_952n,
  maxPayoutBase: 100n * UNIT,
  multiplierMilli: 2_825,
  decimals: DECIMALS,
  quotedAtMs: FIXTURE_NOW_MS,
};

export const QUOTE_ERROR: Diagnosis = diagnosis("no-liquidity", "ThinBook(0x…11393, 0, 20000000)", { errorName: "ThinBook" });

function round(n: number, patch: Partial<RangeRoundView>): RangeRoundView {
  const base: Omit<RangeRoundView, "kind"> = {
    roundId: BigInt(n),
    owner: OWNER,
    status: "live",
    side: "inside",
    marketId: WINDOW.marketId,
    oracleQuestionId: 49_288n,
    expirySec: NOW_SEC + 240,
    openedAtSec: NOW_SEC - 30,
    settledAtSec: null,
    openingPrint: OPENING,
    lowPrint: OPENING - 3_000n,
    highPrint: OPENING + 3_000n,
    closingPrint: null,
    stakeBase: 35_385_952n,
    maxPayoutBase: 100n * UNIT,
    houseLockedBase: 64_614_048n,
    probRaw: 315_946n,
    asset: "TSLA",
    intervalSec: 300,
    settledOnchain: false,
    ...patch,
  };
  // The kind is read off the band's shape, exactly as the live view does it.
  return { ...base, kind: patch.kind ?? classifyRangeBand(base.openingPrint, base.lowPrint, base.highPrint) };
}

export const ROUNDS: RangeRoundView[] = [
  round(6, {}),
  round(5, { expirySec: NOW_SEC - 20, settledOnchain: true }),
  round(4, { status: "won", expirySec: NOW_SEC - 400, settledAtSec: NOW_SEC - 396, closingPrint: OPENING + 1_000n }),
  round(3, { status: "lost", expirySec: NOW_SEC - 900, settledAtSec: NOW_SEC - 896, closingPrint: OPENING + 5_000n }),
  round(2, { status: "void", side: "outside", expirySec: NOW_SEC - 1_800, settledAtSec: NOW_SEC - 1_700 }),
  round(1, { status: "claimed", side: "outside", expirySec: NOW_SEC - 3_600, settledAtSec: NOW_SEC - 3_596, closingPrint: OPENING - 9_000n }),
];
