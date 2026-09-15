/**
 * A void's reason line for the claim card and the claim row (session-lanes.md §3.2, Q-S6-7). The rule and its copy are
 * 6c's core `voidDetail` / void-reason copy; until that lands this derives the same frozen `VoidDetail` from what the
 * web already reads (the Window and its `Resolution`) and renders the spec's words. The deadline needs the frozen
 * policy's admission window, which the web read model doesn't carry, so the line omits it rather than guess.
 */
import type { EventMarket, MarketId, PrintSource, Resolution, VoidDetail } from "@agari/core/types";
import { marketsProvider } from "@agari/markets";
import { keys, useMarket, useReadingQuery } from "@agari/markets/react";
import { etClockSec } from "@/features/markets/lanes/lane-view";
import { CLAIM } from "@/lib/copy";

const SOURCE_NAME: Record<PrintSource, string> = { pyth: "Pyth", redstone: "RedStone", switchboard: "Switchboard", attested: "attested" };

type VoidWindow = Pick<EventMarket, "tradingStartSec" | "expirySec" | "printSource" | "voidReason">;

/** The empty print names the slot; with both present (a divergence) the closing boundary is the one that decided. */
export function voidDetailOf(market: VoidWindow, resolution: Pick<Resolution, "openingRaw" | "closingRaw" | "printSource" | "voidReason"> | null): VoidDetail | null {
  const reason = resolution?.voidReason ?? market.voidReason;
  if (!reason) return null;
  const slot = resolution ? (resolution.openingRaw === null ? "open" : "close") : null;
  return {
    reason,
    slot,
    source: resolution?.printSource ?? market.printSource,
    boundarySec: slot === "open" ? market.tradingStartSec : market.expirySec,
    deadlineSec: null,
  };
}

/** "No signed Pyth price at 16:00:00 ET was recorded by 16:15:00 ET." / "Pyth and RedStone differed by more than 0.25% at …". */
export function voidReasonLine(detail: VoidDetail | null): string | null {
  if (!detail || detail.boundarySec === null) return null;
  const at = etClockSec(detail.boundarySec);
  if (detail.reason === "cross-check-divergence") return CLAIM.voidReason.divergence(at);
  const source = detail.source ? SOURCE_NAME[detail.source] : null;
  return CLAIM.voidReason.missing(source, at, detail.deadlineSec === null ? null : etClockSec(detail.deadlineSec));
}

/** The Window's `Resolution` under the verdict's own query key, so a void's reason costs no second read. */
export function useVoidLine(marketId: MarketId, enabled: boolean, given: VoidDetail | null | undefined): string | null {
  const market = useMarket(enabled && given === undefined ? marketId : null);
  const resolution = useReadingQuery(keys.resolution(marketId), () => marketsProvider.getResolution(marketId), { enabled: enabled && given === undefined });
  if (!enabled) return null;
  if (given !== undefined) return voidReasonLine(given);
  const window = market?.ok ? market.value : null;
  return window ? voidReasonLine(voidDetailOf(window, resolution?.ok ? resolution.value : null)) : null;
}
