"use client";

import { TICKERS, type TickerSymbol } from "@agari/core/market";
import { BellIcon, BellRingIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { requestNotificationPermission } from "@/features/alerts";
import { HEDGE } from "./copy";
import { dropBellsSnapshot, serverBells, setDropBell, subscribeDropBells } from "./drop-bell";

/**
 * The bell on one row of "Your stocks" (plan Step 8): "Tell me if OpenAI falls 3% within an hour". Switching it on
 * is the click browsers need before they will ask for notification permission; a refusal still leaves the bell on,
 * ringing as an in-app message instead, as the price alerts do.
 */
export function DropBellToggle({ asset }: { asset: TickerSymbol }) {
  const bells = useSyncExternalStore(subscribeDropBells, dropBellsSnapshot, serverBells);
  const on = bells.includes(asset);
  const name = TICKERS[asset].name;
  const toggle = async () => {
    if (!on) await requestNotificationPermission();
    setDropBell(asset, !on);
  };
  return (
    <button type="button" className="ys-bell" data-on={on || undefined} aria-pressed={on} title={HEDGE.bell.foot} onClick={() => void toggle()} data-cursor="hover">
      {on ? <BellRingIcon size={12} aria-hidden /> : <BellIcon size={12} aria-hidden />}
      <span>{on ? HEDGE.bell.on(name) : HEDGE.bell.off(name)}</span>
    </button>
  );
}
