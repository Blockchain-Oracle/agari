import { diagnosis } from "@masayume/core/types";
import { err, ok } from "@masayume/core/schemas";
import { termPoints, type TermPoint } from "@masayume/core/surface";
import { toMarketId, type Address, type BookDepth, type BookLevelView, type EventMarket, type MarketId } from "@masayume/core/types";

// Canned books; nothing here is a real market, pool or order.
const DECIMALS = 6;
const UNIT = 10n ** BigInt(DECIMALS);
export const FIXTURE_SYMBOL = "tUSDC";
export const FIXTURE_DECIMALS = DECIMALS;
export const FIXTURE_LOT = UNIT / 100n;
export const FIXTURE_NOW_MS = Date.UTC(2026, 8, 3, 9, 0, 0);
const NOW_SEC = Math.floor(FIXTURE_NOW_MS / 1000);
const id = (n: number): MarketId => toMarketId(`0x${n.toString(16).padStart(64, "0")}`);

const level = (cents: number, contracts: number): BookLevelView => ({
  priceRaw: BigInt(cents) * (UNIT / 100n),
  priceBps: cents * 100,
  quantityRaw: BigInt(Math.round(contracts * 100)) * (UNIT / 100n),
});
const mirror = (levels: BookLevelView[]): BookLevelView[] => levels.map((l) => ({ priceRaw: UNIT - l.priceRaw, priceBps: 10_000 - l.priceBps, quantityRaw: l.quantityRaw }));
const book = (upBids: BookLevelView[], upAsks: BookLevelView[]): BookDepth => ({ upBids, upAsks, downBids: mirror(upAsks), downAsks: mirror(upBids), decimals: DECIMALS });

/** A maker's two-sided book around 62¢, thinning outward — the 15m lane on a quiet morning. */
export const TWO_SIDED = book(
  [level(60, 5), level(59, 5), level(57, 12), level(55, 20), level(50, 40)],
  [level(64, 5), level(65, 5), level(67, 10), level(70, 25), level(75, 60)],
);
/** The 5m lane mid-requote (context/48): the maker's whole ladder re-laid, bids over asks. */
export const CROSSED = book(
  [level(87, 200), level(86, 330), level(85, 460)],
  [level(78, 200), level(79, 330), level(80, 460)],
);
/** Only asks resting: a price, not a market. */
export const ONE_SIDED = book([], [level(64, 5), level(66, 8)]);
/** A single thin pair: a wide spread and almost no size. */
export const THIN = book([level(40, 0.5)], [level(70, 0.5)]);
export const EMPTY = book([], []);

function market(n: number, intervalSec: number, expiresInSec: number, openingPriceRaw: bigint | null = 7_795_612n): EventMarket {
  return {
    marketId: id(n),
    venueId: null,
    asset: "BTC",
    question: "",
    intervalSec,
    strikeRaw: 0n,
    isUpDown: true,
    tradingStartSec: NOW_SEC + expiresInSec - intervalSec,
    expirySec: NOW_SEC + expiresInSec,
    poolAddress: "0x0000000000000000000000000000000000000001" as Address,
    marketAddress: "0x0000000000000000000000000000000000000002" as Address,
    nonce: null,
    yesTokenId: 0n,
    noTokenId: 0n,
    collateral: "0x0000000000000000000000000000000000000003" as Address,
    decimals: DECIMALS,
    status: "Trading",
    winningOutcome: null,
    voided: false,
    finalized: null,
    openingPriceRaw,
    oracleQuestionId: null,
    volumeQuoteRaw: 0n,
    tradeCount: 0,
    lastPriceRaw: null,
    resolvedAtMs: null,
  };
}

export const MARKET = market(0x11393, 900, 7 * 60 + 12);
export const MARKET_NO_PRINT = market(0x11394, 300, 4 * 60 + 50, null);
export const SPOT_RAW = 7_801_040n;

export const WINDOWS: EventMarket[] = [market(1, 300, 130), MARKET, market(3, 3_600, 2_400), market(4, 14_400, 9_100), market(5, 86_400, 60_000)];

/** Five live Windows: two-sided, two-sided, crossed, a failed read, one-sided. */
export const POINTS: TermPoint[] = termPoints(
  [
    { market: WINDOWS[0]!, book: ok(book([level(52, 8)], [level(55, 8)]), FIXTURE_NOW_MS) },
    { market: WINDOWS[1]!, book: ok(TWO_SIDED, FIXTURE_NOW_MS) },
    { market: WINDOWS[2]!, book: ok(CROSSED, FIXTURE_NOW_MS) },
    { market: WINDOWS[3]!, book: err(diagnosis("rpc-down", "read timed out")) },
    { market: WINDOWS[4]!, book: ok(ONE_SIDED, FIXTURE_NOW_MS) },
  ],
  FIXTURE_NOW_MS,
);
