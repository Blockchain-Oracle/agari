"use client";

import { oneUnit } from "@masayume/core/units";
import { BellIcon, PlusIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFloatingMenus } from "@/components/shell/header/useFloatingMenus";
import { ORACLE_SCALE } from "@/features/markets/hero";
import { cn } from "@/lib/utils";
import { ALERTS } from "./copy";
import {
  addAlert,
  loadAlerts,
  notificationState,
  removeAlert,
  requestNotificationPermission,
  subscribeAlerts,
  type AlertDirection,
  type PriceAlert,
} from "./store";

interface PriceAlertsButtonProps {
  asset: string;
  /** The live price on the oracle's display scale, or null before the first tick. */
  currentRaw: bigint | null;
}

/** Whole dollars as the input wants them — no grouping, since it is `type="number"`. */
function wholeDollars(raw: bigint): string {
  return (raw / oneUnit(ORACLE_SCALE)).toString();
}

/**
 * The bell and its popover — ported from `reference/yosuku/components/PriceAlerts.tsx`.
 *
 * Element for element the reference's: the bell tints vermilion and shows a count once
 * this asset has rules; the popover holds Above/Below, a target that defaults to the live
 * price, the + button, and the active list. Two things differ. The popover opens upward:
 * it sits in the hero foot, and the panel clips its overflow, so downward would be cut
 * off. And the foot line says where an alert fires — in the pinned source `checkAlerts`
 * has no caller, so the reference could not say.
 */
export function PriceAlertsButton({ asset, currentRaw }: PriceAlertsButtonProps) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [targetPrice, setTargetPrice] = useState("");
  const [direction, setDirection] = useState<AlertDirection>("above");
  const [notifications, setNotifications] = useState(notificationState());
  const wrapRef = useRef<HTMLDivElement>(null);
  const refs = useRef([wrapRef]);

  // Hydrate after mount so the server and the first client render agree, then follow
  // every write — including the evaluator marking a rule triggered.
  useEffect(() => {
    const sync = () => setAlerts(loadAlerts().filter((alert) => !alert.triggered));
    sync();
    return subscribeAlerts(sync);
  }, []);

  useEffect(() => {
    if (currentRaw !== null && !targetPrice) setTargetPrice(wholeDollars(currentRaw));
  }, [currentRaw, targetPrice]);

  const close = useCallback(() => setOpen(false), []);
  useFloatingMenus(refs.current, close);

  const handleAdd = async () => {
    const price = parseFloat(targetPrice);
    if (Number.isNaN(price) || price <= 0) return;
    await requestNotificationPermission();
    setNotifications(notificationState());
    addAlert(asset, price, direction);
    setTargetPrice("");
  };

  const assetAlerts = alerts.filter((alert) => alert.asset === asset);
  const count = assetAlerts.length;

  return (
    <div ref={wrapRef} className="alerts-wrap">
      <button
        type="button"
        onClick={() => setOpen((prior) => !prior)}
        className={cn("alerts-button", count > 0 && "armed")}
        aria-label={ALERTS.buttonLabel(asset)}
        aria-expanded={open}
        data-cursor="hover"
      >
        <BellIcon className="alerts-bell" aria-hidden />
        {count > 0 ? count : ALERTS.button}
      </button>

      {open && (
        <div className="alerts-pop bg-neutral-900/96" role="dialog" aria-label={ALERTS.title}>
          <div className="alerts-pop-head">
            <h4 className="alerts-pop-title">{ALERTS.title}</h4>
            <button type="button" onClick={close} className="alerts-pop-close" aria-label={ALERTS.close} data-cursor="hover">
              <XIcon className="alerts-icon-xs" aria-hidden />
            </button>
          </div>

          <div className="alerts-form">
            <div className="alerts-dir">
              <button type="button" onClick={() => setDirection("above")} className={cn("alerts-dir-btn above", direction === "above" && "on")} data-cursor="hover">
                {ALERTS.above}
              </button>
              <button type="button" onClick={() => setDirection("below")} className={cn("alerts-dir-btn below", direction === "below" && "on")} data-cursor="hover">
                {ALERTS.below}
              </button>
            </div>
            <div className="alerts-add">
              <input
                type="number"
                inputMode="decimal"
                value={targetPrice}
                onChange={(event) => setTargetPrice(event.target.value)}
                placeholder={ALERTS.targetPlaceholder}
                aria-label={ALERTS.targetLabel}
                className="alerts-input"
              />
              <button type="button" onClick={() => void handleAdd()} className="alerts-plus" aria-label={ALERTS.add} data-cursor="hover">
                <PlusIcon className="alerts-icon-sm" aria-hidden />
              </button>
            </div>
          </div>

          {assetAlerts.length > 0 && (
            <ul className="alerts-list">
              {assetAlerts.map((alert) => (
                <li key={alert.id} className="alerts-row">
                  <span className="alerts-row-label">
                    <span className={alert.direction === "above" ? "alerts-up" : "alerts-down"}>{alert.direction === "above" ? "↑" : "↓"}</span>{" "}
                    ${alert.targetPrice.toLocaleString()}
                  </span>
                  <button type="button" onClick={() => removeAlert(alert.id)} className="alerts-remove" aria-label={ALERTS.remove} data-cursor="hover">
                    <XIcon className="alerts-icon-xxs" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="alerts-foot">{notifications === "granted" ? ALERTS.foot.on : ALERTS.foot.off}</p>
        </div>
      )}
    </div>
  );
}
