"use client";

import { TICKERS, type TickerSymbol } from "@agari/core/market";
import { marketsProvider } from "@agari/markets";
import { useAssetPrice } from "@agari/markets/react";
import { useEffect, useRef, useState } from "react";
import { sendNotification } from "@/features/alerts";
import { basisRaw, feedRawToOracleRaw, usdLine } from "@/features/markets/hero/units";
import { notify } from "@/lib/toast";
import { HEDGE } from "./copy";
import { bpsToPctText, DROP_BPS, dropBps, dropBellsSnapshot, hourHigh, keepHour, subscribeDropBells, type PriceSample } from "./drop-bell";

/** A price published longer ago than this is not a sample: a frozen feed must never ring the bell. */
const SAMPLE_MAX_AGE_SEC = 300;
/** Rung once per stock per tab session; the hour of samples is kept per tab too, across page changes (module state). */
const rung = new Set<TickerSymbol>();
const hours = new Map<TickerSymbol, PriceSample[]>();

/**
 * One stock's watch. Reads the same live price every other surface reads (the 24/7 token price for an xStock or a
 * PreStocks token), keeps the trailing hour of publishes, and rings once when the latest sits 3% or more under the
 * hour's high. The message states what happened, never what will: "OpenAI fell 3.4% in the last hour".
 */
function AssetWatch({ asset }: { asset: TickerSymbol }) {
  const reading = useAssetPrice(asset);
  const price = reading?.ok ? reading.value : null;
  const raw = price ? feedRawToOracleRaw(basisRaw(price), price.decimals) : null;
  const publishTimeSec = price?.publishTimeSec ?? null;
  const seenSec = useRef<number | null>(null);

  useEffect(() => {
    if (raw === null || publishTimeSec === null || publishTimeSec === seenSec.current) return;
    seenSec.current = publishTimeSec;
    const nowSec = Math.floor(marketsProvider.nowMs() / 1000);
    if (nowSec - publishTimeSec > SAMPLE_MAX_AGE_SEC) return;
    const hour = keepHour(hours.get(asset) ?? [], { sec: publishTimeSec, raw });
    hours.set(asset, hour);
    const bps = dropBps(hour);
    if (bps < DROP_BPS || rung.has(asset)) return;
    rung.add(asset);
    const high = hourHigh(hour)!;
    const title = HEDGE.bell.fired.title(TICKERS[asset].name, bpsToPctText(bps));
    const body = HEDGE.bell.fired.body(usdLine(high.raw), usdLine(raw, high.raw));
    sendNotification(title, body);
    notify.neutral(title, body);
  }, [asset, raw, publishTimeSec]);

  return null;
}

/**
 * The bell's evaluator (plan Step 8), mounted once beside `AlertsWatcher`: one price watch per stock the person
 * switched the bell on for, picked up the moment the toggle saves it. With no bell on it reads nothing at all.
 */
export function DropBellWatcher() {
  const [assets, setAssets] = useState<readonly TickerSymbol[]>([]);

  useEffect(() => {
    const sync = () => setAssets(dropBellsSnapshot());
    sync();
    return subscribeDropBells(sync);
  }, []);

  return (
    <>
      {assets.map((asset) => (
        <AssetWatch key={asset} asset={asset} />
      ))}
    </>
  );
}
