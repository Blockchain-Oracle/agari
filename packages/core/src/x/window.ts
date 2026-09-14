import { phase } from "../lifecycle";
import type { EventMarket } from "../types";
import type { XInstruction } from "./parse";

export type XWindowSelection = { ok: true; market: EventMarket } | {
  ok: false; code: "no-window" | "window-entry-closed" | "window-not-started" | "opening-price-pending";
  market?: EventMarket;
};

/**
 * Match the requested stock and duration exactly on the Regular lane; never substitute another trade. A token
 * lane Window with the same cadence prices the xStock token, not the stock, so it is never a match here.
 */
export function selectXWindow(markets: readonly EventMarket[], instruction: Pick<XInstruction, "asset" | "intervalSec">, nowMs: number): XWindowSelection {
  const matching = markets.filter(m => m.lane === "regular" && m.asset === instruction.asset && m.intervalSec === instruction.intervalSec)
    .sort((a, b) => a.expirySec - b.expirySec);
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
