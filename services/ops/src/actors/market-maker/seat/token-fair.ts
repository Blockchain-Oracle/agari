/**
 * The token lane's quotes (session-lanes.md §2.4): 24/7 around the xStock spot, capped at `MM_TOKEN_MAX_CASH_PER_WINDOW`.
 * Lane 6b owns this file.
 *
 * The Window settles on Switchboard Surge prints while the chart spot is Jupiter's last swap, and the two sit 10–30 bps
 * apart (spike (a)). Against a 5-minute σ of ~14 bps that basis alone would push the fair to the edge, so the strike
 * move is measured within one source: Jupiter now over Jupiter at the Window's start (`xstock-spot` history). Variance
 * accrues around the clock, so the time left is scaled from calendar to trading seconds before `fairYesTicks`.
 */
import { haltOf, TICKERS } from "@agari/core/market";
import { currentXStockSpot, type XStockSpotFeed } from "../../../prices/xstock-spot";
import { fairYesTicks, TRADING_YEAR_SEC } from "./fair";
import type { LaneQuote, LaneQuoteInput } from "./lane-quote";

const CALENDAR_YEAR_SEC = 365 * 86_400;
/** The spot at a Window's start may be sampled up to this long after T (the feed polls every 5 s). */
const START_SAMPLE_WINDOW_SEC = 15;

/** Trading-time seconds equivalent to `sec` of 24/7 time, so an annual σ in trading time applies unchanged. */
export const tradingSecondsOf = (sec: number) => Math.floor((Math.max(0, sec) * TRADING_YEAR_SEC) / CALENDAR_YEAR_SEC);

export function tokenQuote(input: LaneQuoteInput, spotFeed: XStockSpotFeed | null = currentXStockSpot()): LaneQuote {
  const cap = input.env.tokenMaxCashPerWindow;
  const pull = (why: string): LaneQuote => ({ phase: "pull", fairTicks: null, maxCashPerWindow: cap, why });
  const xstock = TICKERS[input.symbol].xstock?.symbol;
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
