/**
 * Canned holdings and Windows for `/dev/hedge` (session-lanes.md §4): the card's three targets (a trading Gap, a Regular
 * Window in session, a weekend token Window), a holding with no fresh spot, and the cases where no card shows.
 */
import type { EventMarket, LaneSet } from "@agari/core/types";
import { type HedgePick, pickHedge, type HoldingView } from "@/features/hedge";
import { fixtureAddress, fixtureMarketId } from "../fixture-ids";
import { fixtureWindow } from "../fixture-window";
import { CLOCK } from "../session/market-session-fixtures";
import { GAP_CARDS, REGULAR_TRADING, TOKEN_WINDOW } from "../states/lane-fixtures";

const VENUE = fixtureAddress("0x7e");
const E8 = 100_000_000n;

const holding = (symbol: HoldingView["symbol"], underlying: HoldingView["underlying"], sharesE8: bigint, priceE8: bigint | null): HoldingView => ({
  mint: `fixture-${symbol}`,
  symbol,
  issuer: symbol.endsWith("on") ? "ondo" : "xstocks",
  underlying,
  sharesE8,
  exposureUsdE6: priceE8 === null ? null : (sharesE8 * priceE8) / 10n ** 10n,
});

const laneSet = (...markets: EventMarket[]): LaneSet => ({ venueId: VENUE, lanes: [{ basis: markets[0]!.lane, intervalSec: markets[0]!.intervalSec, label: "", markets, nextStartSec: null }] });

/** 12.5 TSLAx at $359.795 → $4,497 (the spec's own example line). */
const TSLAX = holding("TSLAx", "TSLA", 1_250_000_000n, 35_979_500_000n);
const TSLAON = holding("TSLAon", "TSLA", 3n * E8, 35_979_500_000n);
const NVDAX = holding("NVDAx", "NVDA", 519_631_543_549n, 21_099_868_271n);
/** The 13:00–14:00 ET Window: the longest one trading, so the card hedges into it rather than the 5m. */
const HOUR_WINDOW = fixtureWindow({ marketId: fixtureMarketId(0x56_0030), intervalSec: 3_600, expirySec: CLOCK.regularTue + 3_600, decimals: 6, openingPriceRaw: REGULAR_TRADING.openingPriceRaw });

function must(pick: HedgePick | null): HedgePick {
  if (!pick) throw new Error("hedge fixture must pick a target");
  return pick;
}

export const BALANCE_BASE = 2_500_000_000n;

export const HEDGE_FIXTURES = {
  gap: must(pickHedge([TSLAX], laneSet(GAP_CARDS[1]!.market), CLOCK.weekendSat * 1000)),
  session: must(pickHedge([TSLAX, TSLAON], laneSet(HOUR_WINDOW, REGULAR_TRADING), CLOCK.regularTue * 1000)),
  token: must(pickHedge([NVDAX, TSLAX], laneSet(TOKEN_WINDOW), CLOCK.weekendSat * 1000)),
  noPrice: must(pickHedge([holding("TSLAx", "TSLA", 1_250_000_000n, null)], laneSet(GAP_CARDS[1]!.market), CLOCK.weekendSat * 1000)),
} as const;

/** No card: no verified holding, and a holding whose underlying has no trading Window (SPYx before the token lane lists). */
export const NO_CARD = {
  empty: pickHedge([], laneSet(GAP_CARDS[1]!.market), CLOCK.weekendSat * 1000),
  noWindow: pickHedge([holding("SPYx", "SPY", 2n * E8, null)], laneSet(GAP_CARDS[1]!.market), CLOCK.weekendSat * 1000),
} as const;
