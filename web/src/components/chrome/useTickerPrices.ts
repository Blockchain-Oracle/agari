"use client";

import { isOk } from "@masayume/core/schemas";
import type { AssetPrice } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import { PRICE_BASIS } from "@masayume/markets/identity";
import { useAssetPrice } from "@masayume/markets/react";
import { useRef } from "react";
import type { TickerDirection, TickerEntry } from "./TickerItem";

/** Fixed hook budget: the strip shows at most this many assets, so the hook count never depends on data. */
export const TICKER_SLOTS = 4;

const PRICE_DP = 2;

/** The strip shows the series the Window settles on (PRICE_BASIS), so the ticker and the hero never disagree. */
function basisRaw(price: AssetPrice): bigint {
  return PRICE_BASIS === "ema" ? price.emaRaw : price.priceRaw;
}

function useAssetSlot(asset: string | null): TickerEntry | null {
  const reading = useAssetPrice(asset);
  // Direction is "last move", so it must survive renders where the price did not change; a ref carries it.
  const last = useRef<{ raw: bigint; direction: TickerDirection } | null>(null);

  if (asset === null || reading === null || !isOk(reading) || reading.value === null) return null;
  const raw = basisRaw(reading.value);
  if (last.current === null) last.current = { raw, direction: "flat" };
  else if (last.current.raw !== raw) last.current = { raw, direction: raw > last.current.raw ? "up" : "down" };

  return {
    asset,
    priceText: `$${formatBaseUnits(raw, reading.value.decimals, { maxDp: PRICE_DP, minDp: PRICE_DP })}`,
    direction: last.current.direction,
    ...(reading.stale ? { staleAsOfMs: reading.asOfMs } : {}),
  };
}

export function useTickerPrices(assets: readonly string[]): TickerEntry[] {
  const slots = [
    useAssetSlot(assets[0] ?? null),
    useAssetSlot(assets[1] ?? null),
    useAssetSlot(assets[2] ?? null),
    useAssetSlot(assets[3] ?? null),
  ];
  return slots.filter((entry): entry is TickerEntry => entry !== null);
}
