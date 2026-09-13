import type { MakerVaultState, MakerWindowView } from "@masayume/core/maker";
import { toMarketId, type Address, type EventMarket, type MarketId } from "@masayume/core/types";
import { WINDOW } from "@/app/dev/range/fixtures";

// Canned readings; nothing here is a real vault, address or deployment.
const DECIMALS = 6;
const UNIT = 10n ** BigInt(DECIMALS);
export const FIXTURE_SYMBOL = "tUSDC";
export const FIXTURE_NOW_MS = Date.UTC(2026, 8, 2, 10, 0, 0);
const NOW_SEC = Math.floor(FIXTURE_NOW_MS / 1000);
const id = (n: number): MarketId => toMarketId(`0x${n.toString(16).padStart(64, "0")}`);

export const VAULT: MakerVaultState = {
  deployment: { chainId: 50312, marketMakerVault: "0x00000000000000000000000000000000000000c9" as Address, fromBlock: 478_000_000n },
  params: {
    maxExposureBps: 6_000,
    minSpreadRaw: 20_000n,
    minPriceRaw: 50_000n,
    maxPriceRaw: 950_000n,
    maxQuantityRaw: 20n * UNIT,
    maxWindowDeployedBase: 200n * UNIT,
    maxOpenWindows: 8,
    minTimeLeftSec: 45,
  },
  maker: "0x0000000000000000000000000000000000000a7e" as Address,
  paused: false,
  liquidBase: 4_961n * UNIT + 260_000n,
  deployedBase: 38n * UNIT + 960_000n,
  totalValueBase: 5_000n * UNIT + 220_000n,
  sharePriceRaw: 1_000_044n,
  utilizationBps: 78,
  supplyShares: 5_000n * UNIT,
  openWindows: [id(0x11542), id(0x11541)],
  decimals: DECIMALS,
};

function view(n: number, patch: Partial<MakerWindowView>): MakerWindowView {
  return {
    marketId: id(n),
    escrowOutBase: 19_480_000n,
    escrowBackBase: 0n,
    mergedBase: 0n,
    payoutBase: 0n,
    openedAtSec: NOW_SEC - 120,
    settledAtSec: null,
    quoteCount: 1,
    settled: false,
    yesRaw: 0n,
    noRaw: 0n,
    deployedBase: 19_480_000n,
    realizedBase: null,
    ...patch,
  };
}

export const OPEN: MakerWindowView[] = [
  view(0x11542, {}),
  view(0x11541, { yesRaw: 10n * UNIT, noRaw: 10n * UNIT, quoteCount: 3, escrowOutBase: 58_440_000n, escrowBackBase: 38_960_000n, deployedBase: 19_480_000n }),
  view(0x11540, { yesRaw: 10n * UNIT, escrowOutBase: 19_480_000n, escrowBackBase: 6_300_000n, deployedBase: 13_180_000n }),
];

export const HISTORY: MakerWindowView[] = [
  view(0x1153f, { settled: true, settledAtSec: NOW_SEC - 900, escrowOutBase: 19_480_000n, escrowBackBase: 9_740_000n, mergedBase: 10_000_000n, deployedBase: 0n, realizedBase: 260_000n }),
  view(0x1153e, { settled: true, settledAtSec: NOW_SEC - 1_800, escrowOutBase: 19_480_000n, escrowBackBase: 6_300_000n, payoutBase: 0n, deployedBase: 13_180_000n, realizedBase: -13_180_000n }),
  view(0x1153d, { settled: true, settledAtSec: NOW_SEC - 3_600, escrowOutBase: 19_480_000n, escrowBackBase: 6_300_000n, payoutBase: 20_000_000n, deployedBase: 0n, realizedBase: 6_820_000n }),
];

/** The Windows the rows name, as the screen reads them in one round (labels and expiries; two already closed). */
export const MARKETS: ReadonlyMap<MarketId, EventMarket> = new Map<MarketId, EventMarket>(
  (
    [
      [0x11542, "BTC", 300, 240],
      [0x11541, "ETH", 900, 600],
      [0x11540, "BTC", 3_600, -30],
      [0x1153f, "ETH", 300, -900],
      [0x1153e, "BTC", 300, -1_800],
      [0x1153d, "BTC", 900, -3_600],
    ] as const
  ).map(([n, asset, intervalSec, leftSec]) => [id(n), { ...WINDOW, marketId: id(n), asset, intervalSec, tradingStartSec: NOW_SEC + leftSec - intervalSec, expirySec: NOW_SEC + leftSec }]),
);
