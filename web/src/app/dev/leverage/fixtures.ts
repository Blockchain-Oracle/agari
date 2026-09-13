import type { LeverageMark, LeveragePosition, LeverageQuote, LeverageReserveState } from "@masayume/core/leverage";
import { toMarketId, type Address, type MarketId } from "@masayume/core/types";

// Canned readings; nothing here is a real position, address or deployment.
const DECIMALS = 6;
const UNIT = 10n ** BigInt(DECIMALS);
export const FIXTURE_SYMBOL = "tUSDC";
export const FIXTURE_NOW_MS = Date.UTC(2026, 8, 2, 10, 0, 0);
const NOW_SEC = Math.floor(FIXTURE_NOW_MS / 1000);
export const OWNER = "0x000000000000000000000000000000000000d357" as Address;
const id = (n: number): MarketId => toMarketId(`0x${n.toString(16).padStart(64, "0")}`);
export const MARKET = { asset: "BTC", intervalSec: 300 };

export const RESERVE: LeverageReserveState = {
  deployment: { chainId: 50312, leverageReserve: "0x00000000000000000000000000000000000000d9" as Address, fromBlock: 477_950_000n },
  params: {
    maxLeverageBps: 30_000,
    premiumBps: 800,
    maintenanceBps: 12_000,
    maxExposureBps: 6_000,
    minEntryPriceRaw: 50_000n,
    maxEntryPriceRaw: 950_000n,
    maxFrontedPerPositionBase: 200n * UNIT,
    maxWindowFrontedBase: 500n * UNIT,
    maxOpenPositions: 64,
    minTimeLeftSec: 90,
  },
  liquidBase: 4_990n * UNIT + 800_000n,
  outstandingBase: 10n * UNIT,
  totalValueBase: 5_000n * UNIT + 800_000n,
  utilizationBps: 20,
  supplyShares: 5_000n * UNIT,
  paused: false,
  openPositions: 1,
  decimals: DECIMALS,
};

/** 10 at 2× on a 0.60 book — the shared vectors' first row. */
export const QUOTE: LeverageQuote = {
  side: "up",
  leverageBps: 20_000,
  quantityRaw: 32n * UNIT,
  costBase: 19_200_000n,
  limitYesRaw: 600_000n,
  priceRaw: 600_000n,
  stakeBase: 10n * UNIT,
  frontedBase: 10n * UNIT,
  premiumBase: 800_000n,
  winIfRightBase: 22n * UNIT,
  lineBase: 12n * UNIT,
  decimals: DECIMALS,
  quotedAtMs: FIXTURE_NOW_MS,
};

function position(overrides: Partial<LeveragePosition> & { positionId: bigint }): LeveragePosition {
  return {
    owner: OWNER,
    status: "live",
    side: "up",
    leverageBps: 20_000,
    marketId: id(0x11393),
    openedAtSec: NOW_SEC - 120,
    expirySec: NOW_SEC + 180,
    exitedAtSec: null,
    quantityRaw: 32n * UNIT,
    stakeBase: 10n * UNIT,
    frontedBase: 10n * UNIT,
    premiumBase: 800_000n,
    entryPriceRaw: 600_000n,
    proceedsBase: 0n,
    reclaimedBase: 0n,
    returnedBase: 0n,
    ...overrides,
  };
}

export const LIVE = position({ positionId: 1n });
export const LIVE_3X = position({ positionId: 2n, side: "down", leverageBps: 30_000, quantityRaw: 45_710_000n, frontedBase: 19_998_592n, premiumBase: 1_599_887n, entryPriceRaw: 420_000n });
export const SETTLING = position({ positionId: 3n, expirySec: NOW_SEC - 20 });
export const WON = position({ positionId: 4n, status: "settled", exitedAtSec: NOW_SEC - 600, expirySec: NOW_SEC - 700, quantityRaw: 0n, frontedBase: 0n, proceedsBase: 32n * UNIT, reclaimedBase: 10n * UNIT, returnedBase: 22n * UNIT });
export const LOST = position({ positionId: 5n, status: "settled", exitedAtSec: NOW_SEC - 900, expirySec: NOW_SEC - 1000, quantityRaw: 0n, frontedBase: 0n });
export const KNOCKED = position({ positionId: 6n, status: "knocked-out", exitedAtSec: NOW_SEC - 1200, expirySec: NOW_SEC - 900, quantityRaw: 0n, frontedBase: 0n, proceedsBase: 11_200_000n, reclaimedBase: 10n * UNIT, returnedBase: 1_200_000n });
export const CLOSED = position({ positionId: 7n, status: "closed", exitedAtSec: NOW_SEC - 1500, expirySec: NOW_SEC - 1300, quantityRaw: 0n, frontedBase: 0n, proceedsBase: 18_560_000n, reclaimedBase: 10n * UNIT, returnedBase: 8_560_000n });

export const MARK_HEALTHY: LeverageMark = { markBase: 18_559_999n, filledRaw: 32n * UNIT, lineBase: 12n * UNIT, knockable: false };
export const MARK_AT_LINE: LeverageMark = { markBase: 11_199_999n, filledRaw: 32n * UNIT, lineBase: 12n * UNIT, knockable: true };
export const MARK_UNPRICED: LeverageMark = { markBase: 0n, filledRaw: 0n, lineBase: 12n * UNIT, knockable: true };
