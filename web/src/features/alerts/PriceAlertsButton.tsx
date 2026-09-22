"use client";

import { BellIcon, PlusIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFloatingMenus } from "@/components/shell/header/useFloatingMenus";
import { ORACLE_SCALE, assetPriceLine } from "@/features/markets/hero/units";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { cn } from "@/lib/utils";
import "./alerts-basis.css";
import { ALERTS } from "./copy";
import { notificationState, requestNotificationPermission } from "./notifications";
import { addAlert, centsToRaw, loadAlerts, parseTargetCents, removeAlert, subscribeAlerts, type AlertDirection, type PriceAlert } from "./store";

interface PriceAlertsButtonProps {
  asset: string;
  /** The live price on the oracle's display scale, or null before the first tick. */
  currentRaw: bigint | null;
}

/** The live price at the headline's scale (`assetPriceLine`: cents below $1,000), as a `type="number"` input wants it. */
function defaultTarget(asset: string, raw: bigint): string {
  return assetPriceLine(asset, raw).replace(/[$,]/g, "").replace(/ pts$/, "");
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
 *
 * S13 (spec §1.5): targets are cents, shown with `assetPriceLine`; a basis row above Above/Below
 * names the spot a rule watches, with the 24/7 token basis disabled until S6; and outside
 * the NYSE session the foot says the rule waits for the open.
 */
export function PriceAlertsButton({ asset, currentRaw }: PriceAlertsButtonProps) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [targetPrice, setTargetPrice] = useState("");
  const [direction, setDirection] = useState<AlertDirection>("above");
  const [notifications, setNotifications] = useState(notificationState());
  const session = useMarketSession();
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
    if (currentRaw !== null && !targetPrice) setTargetPrice(defaultTarget(asset, currentRaw));
  }, [currentRaw, targetPrice]);

  const close = useCallback(() => setOpen(false), []);
  useFloatingMenus(refs.current, close);

  const handleAdd = async () => {
    const targetCents = parseTargetCents(targetPrice);
    if (targetCents === null) return;
    await requestNotificationPermission();
    setNotifications(notificationState());
    addAlert(asset, "regular", targetCents, direction);
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
            <div className="alerts-dir" role="group" aria-label={ALERTS.basis.label}>
              <button type="button" className="alerts-dir-btn alerts-basis on" aria-pressed data-cursor="hover">
                {ALERTS.basis.regular}
              </button>
              <button type="button" className="alerts-dir-btn alerts-basis" disabled title={ALERTS.basis.tokenPending} aria-label={`${ALERTS.basis.token}: ${ALERTS.basis.tokenPending}`}>
                {ALERTS.basis.token}
              </button>
            </div>
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
                step="0.01"
                min="0.01"
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
                    {assetPriceLine(asset, centsToRaw(alert.targetCents, ORACLE_SCALE))}
                  </span>
                  <button type="button" onClick={() => removeAlert(alert.id)} className="alerts-remove" aria-label={ALERTS.remove} data-cursor="hover">
                    <XIcon className="alerts-icon-xxs" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="alerts-foot">{!session?.open ? ALERTS.foot.waiting(session?.label ?? null) : notifications === "granted" ? ALERTS.foot.on : ALERTS.foot.off}</p>
        </div>
      )}
    </div>
  );
}
