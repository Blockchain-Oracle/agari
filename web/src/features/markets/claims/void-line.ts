/**
 * A void's words for the claim card and the claim row (session-lanes.md §3.2, Q-S6-7), all from core: `voidDetail`
 * decides the slot, source, boundary and deadline from the Window and its `Resolution`; `voidLines` gives Masayume's
 * headline and the reason line; `VOID_SHARE_WORD` the stamp. The web read model has no check prints, so a divergence
 * names no check source unless a caller (a `/dev` fixture) passes one.
 */
import { VOID_SHARE_WORD, voidDetail, voidLines } from "@agari/core/market";
import type { EventMarket, MarketId, PrintSource, Resolution, VoidDetail } from "@agari/core/types";
import { marketsProvider } from "@agari/markets";
import { keys, useMarket, useReadingQuery } from "@agari/markets/react";

export interface VoidWords {
  /** "VOID · MISSING PRINT" / "VOID · CROSS-CHECK DIVERGENCE". */
  shareWord: string;
  /** "Void — no reliable print, both sides pay 0.5", verbatim. */
  headline: string;
  /** "No signed Pyth price at 16:00:00 ET was recorded by 16:15:00 ET." */
  reason: string;
}

/** A void the caller already holds (`/dev` fixtures), with the check source a live read can't know. */
export interface GivenVoid {
  detail: VoidDetail | null;
  checkSource?: PrintSource | null;
}

type VoidWindow = Pick<EventMarket, "voidReason" | "lane" | "printSource" | "tradingStartSec" | "lockAtSec" | "expirySec">;

/** Pure: the Window and (when read) its Resolution → the core detail. An unread Resolution leaves both prints `undefined`. */
export function voidDetailOf(market: VoidWindow, resolution: Pick<Resolution, "openingRaw" | "closingRaw" | "printSource" | "voidReason"> | null): VoidDetail | null {
  return voidDetail({
    voidReason: market.voidReason ?? resolution?.voidReason ?? null,
    lane: market.lane,
    primarySource: resolution?.printSource ?? market.printSource,
    tradingStartSec: market.tradingStartSec,
    lockAtSec: market.lockAtSec,
    expirySec: market.expirySec,
    openE8: resolution ? resolution.openingRaw : undefined,
    closeE8: resolution ? resolution.closingRaw : undefined,
  });
}

export function voidWords(given: GivenVoid): VoidWords | null {
  if (!given.detail) return null;
  const [headline, reason] = voidLines(given.detail, { checkSource: given.checkSource ?? null });
  return { shareWord: VOID_SHARE_WORD[given.detail.reason], headline, reason };
}

/** The Window's `Resolution` under the verdict's own query key, so a void's reason costs no second read. */
export function useVoidWords(marketId: MarketId, enabled: boolean, given: GivenVoid | undefined): VoidWords | null {
  const live = enabled && given === undefined;
  const market = useMarket(live ? marketId : null);
  const resolution = useReadingQuery(keys.resolution(marketId), () => marketsProvider.getResolution(marketId), { enabled: live });
  if (!enabled) return null;
  if (given !== undefined) return voidWords(given);
  const window = market?.ok ? market.value : null;
  return window ? voidWords({ detail: voidDetailOf(window, resolution?.ok ? resolution.value : null) }) : null;
}
