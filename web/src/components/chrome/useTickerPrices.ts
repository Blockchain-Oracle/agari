"use client";

import { isOk } from "@agari/core/schemas";
import { isTickerSymbol } from "@agari/core/market";
import type { AssetPrice } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { PRICE_BASIS } from "@agari/markets/identity";
import { useAssetPrice } from "@agari/markets/react";
import { useRef } from "react";
import { useDailyCloses } from "@/features/markets/asset-history";
import { assetPriceLine, assetSpotLine, feedRawToOracleRaw } from "@/features/markets/hero/units";
import type { MarketSession } from "@/features/markets/session";
import type { TickerDirection, TickerEntry } from "./TickerItem";

/** Fixed hook budget: the strip shows at most this many assets, so the hook count never depends on data. */
export const TICKER_SLOTS = 4;

const PRICE_DP = 2;

/** The strip shows the series the Window settles on (PRICE_BASIS), so the ticker and the hero never disagree. */
function basisRaw(price: AssetPrice): bigint {
  return PRICE_BASIS === "ema" ? price.emaRaw : price.priceRaw;
}

export interface TickerPricesOptions {
  /** How often the `/prices/latest` fallback polls while the stream is not live; a closed market asks for 60 s (D-086). */
  pollMs?: number;
  /** With a session, a slot the feed has nothing for falls back to the archived last close, flat and marked as the close. */
  session?: MarketSession | null;
}

function useAssetSlot(asset: string | null, { pollMs, session }: TickerPricesOptions): TickerEntry | null {
  const symbol = asset !== null && isTickerSymbol(asset) ? asset : null;
  const reading = useAssetPrice(symbol, pollMs === undefined ? {} : { pollMs });
  const known = reading !== null && isOk(reading) && reading.value !== null;
  // The archive is read only when the feed has answered with nothing: a strip that already has a price never asks.
  const closes = useDailyCloses(symbol, session ?? null, !known && reading !== null);
  // Direction is "last move", so it must survive renders where the price did not change; a ref carries it. A slot can
  // change ticker (the marquee's registry order gives way to live lanes), and one ticker's price is no move for another.
  const last = useRef<{ asset: string; raw: bigint; direction: TickerDirection } | null>(null);

  if (asset === null || reading === null || !isOk(reading) || reading.value === null) {
    if (asset === null || !closes?.last) return null;
    return { asset, priceText: assetPriceLine(asset, closes.last.priceRaw), direction: "flat", closeAsOfSec: closes.last.sec };
  }
  const raw = basisRaw(reading.value);
  if (last.current === null || last.current.asset !== asset) last.current = { asset, raw, direction: "flat" };
  else if (last.current.raw !== raw) last.current = { asset, raw, direction: raw > last.current.raw ? "up" : "down" };

  return {
    asset,
    priceText: assetSpotLine(asset, feedRawToOracleRaw(raw, reading.value.decimals)),
    direction: last.current.direction,
    ...(reading.stale ? { staleAsOfMs: reading.asOfMs } : {}),
  };
}

export function useTickerPrices(assets: readonly string[], options: TickerPricesOptions = {}): TickerEntry[] {
  const slots = [
    useAssetSlot(assets[0] ?? null, options),
    useAssetSlot(assets[1] ?? null, options),
    useAssetSlot(assets[2] ?? null, options),
    useAssetSlot(assets[3] ?? null, options),
  ];
  return slots.filter((entry): entry is TickerEntry => entry !== null);
}
