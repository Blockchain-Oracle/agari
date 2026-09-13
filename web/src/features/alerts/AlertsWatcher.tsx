"use client";

import { oneUnit } from "@masayume/core/units";
import { useAssetPrice } from "@masayume/markets/react";
import { useEffect, useState } from "react";
import { basisRaw, feedRawToOracleRaw, ORACLE_SCALE } from "@/features/markets/hero/units";
import { notify } from "@/lib/toast";
import { ALERTS } from "./copy";
import { checkAlerts, loadAlerts, pendingAssets, sendNotification, subscribeAlerts } from "./store";

const dollars = (raw: bigint): string => `$${(raw / oneUnit(ORACLE_SCALE)).toLocaleString("en-US")}`;

/**
 * One asset's watch. Reads the same live price every other surface reads, on the oracle's
 * display scale, and runs the stored rules against it on every tick that moves.
 */
function AssetWatch({ asset }: { asset: string }) {
  const reading = useAssetPrice(asset);
  const price = reading?.ok ? reading.value : null;
  const raw = price ? feedRawToOracleRaw(basisRaw(price), price.decimals) : null;

  useEffect(() => {
    if (raw === null) return;
    // Display dollars, as the rules are stored; the comparison is not money.
    const fired = checkAlerts({ [asset]: Number(raw) / Number(oneUnit(ORACLE_SCALE)) });
    for (const alert of fired) {
      const title = ALERTS.fired.title(asset, alert.direction, `$${alert.targetPrice.toLocaleString("en-US")}`);
      const body = ALERTS.fired.body(dollars(raw));
      sendNotification(title, body);
      notify.neutral(title, body);
    }
  }, [asset, raw]);

  return null;
}

/**
 * The market-stream evaluator — ours, not the reference's.
 *
 * The reference stores rules and exposes `checkAlerts`, but in the pinned source nothing
 * calls it, so an alert could be set and never fire. This mounts once, inside the shared
 * read runtime, and keeps one price watch per asset that still has a pending rule. A rule
 * saved by the button is picked up through the store's subscription, not a reload.
 */
export function AlertsWatcher() {
  const [assets, setAssets] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setAssets(pendingAssets(loadAlerts()));
    sync();
    return subscribeAlerts(sync);
  }, []);

  return (
    <>
      {assets.map((asset) => (
        <AssetWatch key={asset} asset={asset} />
      ))}
    </>
  );
}
