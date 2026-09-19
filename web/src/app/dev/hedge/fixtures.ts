/**
 * Canned holdings and Windows for `/dev/hedge` (session-lanes.md §4): the card's three targets (a trading Gap, a Regular
 * Window in session, a weekend token Window), a holding with no fresh spot, and the cases where no card shows.
 */
import { isTickerSymbol } from "@agari/core/market";
import type { EventMarket, LaneSet } from "@agari/core/types";
import { type HedgePick, pickHedge, type HoldingView } from "@/features/hedge";
import type { PreIpoMove } from "@/features/ticker-hub/usePreIpoFacts";
import { fixtureAddress, fixtureMarketId } from "../fixture-ids";
import { fixtureWindow } from "../fixture-window";
import { CLOCK } from "../session/market-session-fixtures";
import { GAP_CARDS, REGULAR_TRADING, TOKEN_WINDOW } from "../states/lane-fixtures";

const VENUE = fixtureAddress("0x7e");
const E8 = 100_000_000n;

const holding = (symbol: HoldingView["symbol"], underlying: HoldingView["underlying"], sharesE8: bigint, priceE8: bigint | null): HoldingView => ({
  mint: `fixture-${symbol}`,
  symbol,
  // A PreStocks token's symbol is the ticker itself; Ondo twins end in "on"; everything else is an xStock.
  issuer: isTickerSymbol(symbol) ? "prestocks" : symbol.endsWith("on") ? "ondo" : "xstocks",
  underlying,
  sharesE8,
  exposureUsdE6: priceE8 === null ? null : (sharesE8 * priceE8) / 10n ** 10n,
  priceAgeSec: priceE8 === null ? null : 0,
});

const laneSet = (...markets: EventMarket[]): LaneSet => ({ venueId: VENUE, lanes: [{ basis: markets[0]!.lane, intervalSec: markets[0]!.intervalSec, label: "", markets, nextStartSec: null }] });

/** 4.2 OPENAI PreStocks at $1,127.38 → $4,735: a pre-IPO token, covered on its own 24/7 Window (D-100). */
const OPENAI_PRE = holding("OPENAI", "OPENAI", 420_000_000n, 112_738_000_000n);
/** The 24/7 OPENAI Window the cover card offers; a pre-IPO name has no other lane (D-103). */
const OPENAI_WINDOW = fixtureWindow({ marketId: fixtureMarketId(0x56_0091), asset: "OPENAI", lane: "token", intervalSec: 3_600, expirySec: CLOCK.weekendSat + 3_600, decimals: 6, openingPriceRaw: 112_738_000_000n });

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
  preIpo: must(pickHedge([OPENAI_PRE, TSLAX], laneSet(OPENAI_WINDOW), CLOCK.weekendSat * 1000)),
} as const;

/** 300 SPACEX at $121.32 → $36,396: the calm case (plan §2). SpaceX traded $8,708 in a day and did not move at all. */
const SPACEX_CALM = holding("SPACEX", "SPACEX", 300n * E8, 12_132_000_000n);

/** "Your stocks" with a calm name beside a moving one, and the movement the feed measured for each. */
export const STOCKS_FIXTURE = {
  holdings: [OPENAI_PRE, SPACEX_CALM, TSLAX],
  movement: {
    OPENAI: { windowSec: 7_200, samples: 720, rangeBps: 230, changeBps: -140 },
    SPACEX: { windowSec: 7_200, samples: 720, rangeBps: 0, changeBps: 0 },
  } satisfies Record<string, PreIpoMove>,
  laneSet: laneSet(OPENAI_WINDOW),
} as const;

/** The teaser's calm state: the lead holding is a name that has barely moved, so no Down bet is offered. */
export const CALM_LEAD = SPACEX_CALM;

/** No card: no verified holding, and a holding whose underlying has no trading Window (SPYx before the token lane lists). */
export const NO_CARD = {
  empty: pickHedge([], laneSet(GAP_CARDS[1]!.market), CLOCK.weekendSat * 1000),
  noWindow: pickHedge([holding("SPYx", "SPY", 2n * E8, null)], laneSet(GAP_CARDS[1]!.market), CLOCK.weekendSat * 1000),
} as const;
