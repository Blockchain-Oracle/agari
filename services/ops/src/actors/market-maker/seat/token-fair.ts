/**
 * The token lane's quotes (session-lanes.md §2.4): 24/7 around the xStock spot, capped at `MM_TOKEN_MAX_CASH_PER_WINDOW`.
 * Lane 6b owns this file.
 *
 * The Window settles on Switchboard Surge prints while the chart spot is Jupiter's last swap, and the two sit 10–30 bps
 * apart (spike (a)). Against a 5-minute σ of ~14 bps that basis alone would push the fair to the edge, so the strike
 * move is measured within one source: Jupiter now over Jupiter at the Window's start (`xstock-spot` history). Variance
 * accrues around the clock, so the time left is scaled from calendar to trading seconds before `fairYesTicks`.
 *
 * A pre-IPO name (D-100) and a basket (S19, D-124) share one model, `sampledQuote`, over the PreStocks feed: the print
 * source and the chart spot are one number there, so there is no cross-source basis to hide. A basket's number is its
 * index in points × 10⁸, read from the feed's same-fetch snapshots, so the maker's fair and the venue's print agree.
 */
import { BASKETS, haltOf, TICKERS, type TickerSymbol } from "@agari/core/market";
import { basketIndexAt, basketIndexLatest } from "../../../prices/basket-index";
import { currentPreStocksSpot, type PreStocksSpotFeed } from "../../../prices/prestocks-spot";
import { currentXStockSpot, type XStockSpotFeed } from "../../../prices/xstock-spot";
import { fairYesTicks, TRADING_YEAR_SEC } from "./fair";
import type { LaneQuote, LaneQuoteInput } from "./lane-quote";
import { valuationQuote } from "./valuation-fair";

const CALENDAR_YEAR_SEC = 365 * 86_400;
/** The spot at a Window's start may be sampled up to this long after T (the feed polls every 5 s). */
const START_SAMPLE_WINDOW_SEC = 15;
/** The PreStocks feed polls every 10 s, so its start sample may land a little later. */
const PRE_IPO_START_WINDOW_SEC = 30;

/** Trading-time seconds equivalent to `sec` of 24/7 time, so an annual σ in trading time applies unchanged. */
export const tradingSecondsOf = (sec: number) => Math.floor((Math.max(0, sec) * TRADING_YEAR_SEC) / CALENDAR_YEAR_SEC);

export function tokenQuote(input: LaneQuoteInput, spotFeed: XStockSpotFeed | null = currentXStockSpot(), preFeed: PreStocksSpotFeed | null = currentPreStocksSpot()): LaneQuote {
  const t = TICKERS[input.symbol];
  if (t.kind === "valuation") return valuationQuote(input);
  if (t.kind === "basket") return sampledQuote(input, preFeed && basketAccessors(preFeed, input.symbol), `${input.symbol} index`);
  if (t.preIpo) return sampledQuote(input, preFeed && nameAccessors(preFeed, input.symbol), `${input.symbol} PreStocks`);
  const cap = input.env.tokenMaxCashPerWindow;
  const pull = (why: string): LaneQuote => ({ phase: "pull", fairTicks: null, maxCashPerWindow: cap, why });
  const xstock = t.xstock?.symbol;
  if (!xstock) return pull(`${input.symbol} has no xStock`);
  // Token halts are keyed by the xStock (`issuer-halt`, `quote-unavailable`), never by the ticker.
  const halt = haltOf(input.halts, xstock);
  if (halt) return pull(`halted (${halt.reason})`);
  const m = input.market.data;
  if (input.nowSec >= Number(m.lockAt) - 60) return { phase: "stop", fairTicks: null, maxCashPerWindow: cap, why: "60 s before lock" };
  if (!spotFeed) return pull("no xStock spot feed running");
  const spot = spotFeed.latest(xstock, input.env.spotMaxAgeSec);
  if (!spot) return pull(`${xstock} Jupiter spot stale`);
  if (m.open.source === 0) return { phase: "quote", fairTicks: null, maxCashPerWindow: cap, why: "waiting for the open print" };
  const startSec = Number(m.tradingStart);
  const reference = spotFeed.at(xstock, startSec + START_SAMPLE_WINDOW_SEC, START_SAMPLE_WINDOW_SEC + 5);
  if (!reference) return pull(`no ${xstock} Jupiter sample near the Window's start`);
  const fairTicks = fairYesTicks({
    spotE8: spot.priceE8,
    openE8: reference.priceE8,
    secondsLeft: tradingSecondsOf(Number(m.expiry) - input.nowSec),
    sigmaBps: input.env.sigmaBps(input.symbol),
    minTick: input.env.minTick,
  });
  return { phase: "quote", fairTicks, maxCashPerWindow: cap, why: `${xstock} ${spot.priceE8} vs start ${reference.priceE8}` };
}

/** One number over time, at expo −8: a name's token price or a basket's index. */
export interface SampledSource {
  /** The newest value no older than `maxAgeSec`, or null. */
  latest(maxAgeSec: number): bigint | null;
  /** The newest value at or before `sec` and no older than `windowSec` before it, or null. */
  at(sec: number, windowSec: number): bigint | null;
}

const nameAccessors = (feed: PreStocksSpotFeed, symbol: TickerSymbol): SampledSource => ({
  latest: (maxAgeSec) => feed.latest(symbol, maxAgeSec)?.tokenPriceE8 ?? null,
  at: (sec, windowSec) => feed.at(symbol, sec, windowSec)?.tokenPriceE8 ?? null,
});

const basketAccessors = (feed: PreStocksSpotFeed, symbol: TickerSymbol): SampledSource => {
  const basket = BASKETS[TICKERS[symbol].basket!];
  return {
    latest: (maxAgeSec) => basketIndexLatest(feed.snapshots(), basket, Math.floor(Date.now() / 1000), maxAgeSec)?.indexE8 ?? null,
    at: (sec, windowSec) => basketIndexAt(feed.snapshots(), basket, sec, windowSec)?.indexE8 ?? null,
  };
};

/**
 * The Pre-IPO model (D-100, plan Step 3), shared with baskets (S19): the same 24/7 fair over one sampled number — now
 * against the sample nearest the Window's start. Halts key by the ticker itself (D-103). `source` is null when no
 * PreStocks feed runs in this process.
 */
export function sampledQuote(input: LaneQuoteInput, source: SampledSource | null, label: string): LaneQuote {
  const cap = input.env.tokenMaxCashPerWindow;
  const pull = (why: string): LaneQuote => ({ phase: "pull", fairTicks: null, maxCashPerWindow: cap, why });
  const halt = haltOf(input.halts, input.symbol);
  if (halt) return pull(`halted (${halt.reason})`);
  const m = input.market.data;
  if (input.nowSec >= Number(m.lockAt) - 60) return { phase: "stop", fairTicks: null, maxCashPerWindow: cap, why: "60 s before lock" };
  if (!source) return pull("no PreStocks feed running");
  const spotE8 = source.latest(input.env.spotMaxAgeSec);
  if (spotE8 === null) return pull(`${label} stale`);
  if (m.open.source === 0) return { phase: "quote", fairTicks: null, maxCashPerWindow: cap, why: "waiting for the open print" };
  const startSec = Number(m.tradingStart);
  // The Window's own opening print is the same PreStocks number the venue signed at the start (the print source and
  // the chart are one feed here), so when this process has no sample near the start — it restarted mid-Window — the
  // print stands in for it. Before S23 the lane pulled until the next Window, and a restart left its books empty for
  // up to an hour.
  const sampled = source.at(startSec + PRE_IPO_START_WINDOW_SEC, PRE_IPO_START_WINDOW_SEC + 5);
  const openE8 = sampled ?? m.open.price;
  const fairTicks = fairYesTicks({
    spotE8,
    openE8,
    secondsLeft: tradingSecondsOf(Number(m.expiry) - input.nowSec),
    sigmaBps: input.env.sigmaBps(input.symbol),
    minTick: input.env.minTick,
  });
  return { phase: "quote", fairTicks, maxCashPerWindow: cap, why: `${label} ${spotE8} vs ${sampled === null ? "open print" : "start"} ${openE8}` };
}
