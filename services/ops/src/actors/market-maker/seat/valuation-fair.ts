/**
 * The valuation lane's quotes (S20, D-125): the token-lane model over Pyth's valuation index, the same number the
 * Window settles on, so there is no cross-source basis to hide. The index is read from the process's Pyth index spot,
 * which only polls feeds the key is entitled to; a lane the roller has not listed never reaches here. Halts key by the
 * lane's own symbol (`tokenLaneAsset` answers the valuation ticker itself).
 */
import { haltOf, TICKERS } from "@agari/core/market";
import { currentPythIndexSpot, type PythIndexSpotFeed } from "../../../prices/pyth-index-spot";
import { fairYesTicks } from "./fair";
import type { LaneQuote, LaneQuoteInput } from "./lane-quote";
import { tradingSecondsOf } from "./token-fair";

/** The index polls every 10 s, so its start sample may land a little after T. */
const START_WINDOW_SEC = 30;

export function valuationQuote(input: LaneQuoteInput, feed: PythIndexSpotFeed | null = currentPythIndexSpot()): LaneQuote {
  const cap = input.env.tokenMaxCashPerWindow;
  const pull = (why: string): LaneQuote => ({ phase: "pull", fairTicks: null, maxCashPerWindow: cap, why });
  const name = TICKERS[input.symbol].valuationOf;
  if (!name) return pull(`${input.symbol} is not a valuation lane`);
  const halt = haltOf(input.halts, input.symbol);
  if (halt) return pull(`halted (${halt.reason})`);
  const m = input.market.data;
  if (input.nowSec >= Number(m.lockAt) - 60) return { phase: "stop", fairTicks: null, maxCashPerWindow: cap, why: "60 s before lock" };
  if (!feed) return pull("no Pyth index feed running");
  const spot = feed.latest(name, input.env.spotMaxAgeSec);
  if (!spot) return pull(`${name} Pyth index stale`);
  if (m.open.source === 0) return { phase: "quote", fairTicks: null, maxCashPerWindow: cap, why: "waiting for the open print" };
  const startSec = Number(m.tradingStart);
  const reference = feed.at(name, startSec + START_WINDOW_SEC, START_WINDOW_SEC + 5);
  if (!reference) return pull(`no ${name} Pyth index sample near the Window's start`);
  const fairTicks = fairYesTicks({
    spotE8: spot.indexE8,
    openE8: reference.indexE8,
    secondsLeft: tradingSecondsOf(Number(m.expiry) - input.nowSec),
    sigmaBps: input.env.sigmaBps(input.symbol),
    minTick: input.env.minTick,
  });
  return { phase: "quote", fairTicks, maxCashPerWindow: cap, why: `${name} Pyth index ${spot.indexE8} vs start ${reference.indexE8}` };
}
