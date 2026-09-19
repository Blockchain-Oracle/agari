import { phase } from "../lifecycle";
import { TICKERS, type TickerSymbol } from "../market/tickers";
import type { EventMarket, LaneBasis } from "../types";
import type { XInstruction } from "./parse";

export type XWindowSelection = { ok: true; market: EventMarket } | {
  ok: false; code: "no-window" | "window-entry-closed" | "window-not-started" | "opening-price-pending";
  market?: EventMarket;
};

/**
 * Match the requested stock and duration exactly on the Regular lane; never substitute another trade. A token
 * lane Window with the same cadence prices the xStock token, not the stock, so it is never a match here.
 */
/**
 * The soonest Window a caller may enter, or the nearest reason it may not — shared by the X grammar and by Blinks,
 * which ask the same question of different lane sets. Soonest-expiry first, then the phases in the order a reader
 * cares about: enterable, waiting on its open, closed, not started.
 */
export function pickWindow(markets: readonly EventMarket[], nowMs: number): XWindowSelection {
  const matching = [...markets].sort((a, b) => a.expirySec - b.expirySec);
  const trading = matching.find(m => phase(m, nowMs) === "trading");
  if (trading) return { ok: true, market: trading };
  const pending = matching.find(m => phase(m, nowMs) === "pendingOpeningPrint");
  if (pending) return { ok: false, code: "opening-price-pending", market: pending };
  const closed = matching.find(m => ["noEntryBuffer", "locked"].includes(phase(m, nowMs)));
  if (closed) return { ok: false, code: "window-entry-closed", market: closed };
  const upcoming = matching.find(m => phase(m, nowMs) === "upcoming");
  if (upcoming) return { ok: false, code: "window-not-started", market: upcoming };
  return { ok: false, code: "no-window" };
}

export function selectXWindow(markets: readonly EventMarket[], instruction: Pick<XInstruction, "asset" | "intervalSec">, nowMs: number): XWindowSelection {
  return pickWindow(markets.filter(m => m.lane === "regular" && m.asset === instruction.asset && m.intervalSec === instruction.intervalSec), nowMs);
}

/**
 * Which lane actually prices this name. A stock is priced on Regular; the token lane with the same ticker prices its
 * *xStock token*, which is a different underlying, so a stock never resolves there — the same rule `selectXWindow`
 * enforces. A pre-IPO name has no NYSE session and lists only on the 24/7 token lane (D-103).
 *
 * `laneListable` is not this rule: it only forbids a pre-IPO name off the token lane, and would happily route TSLA
 * onto TSLAX.
 */
export function actionLane(asset: TickerSymbol): LaneBasis {
  return TICKERS[asset].kind === "preIpo" ? "token" : "regular";
}

/**
 * The same question for a Blink, which is a link rather than a sentence: a shared URL outlives any one Window, so it
 * names an asset and a cadence and resolves to whatever is tradeable now, on the one lane that prices that name.
 */
export function selectActionWindow(markets: readonly EventMarket[], target: Pick<XInstruction, "asset" | "intervalSec">, nowMs: number): XWindowSelection {
  const lane = actionLane(target.asset);
  return pickWindow(markets.filter(m => m.asset === target.asset && m.intervalSec === target.intervalSec && m.lane === lane), nowMs);
}
