"use client";

import type { TickerSymbol } from "@agari/core/market";
import { ROOM } from "./copy";
import "./room-switch.css";

export type RoomScope = "window" | "ticker";

interface RoomSwitchProps {
  symbol: TickerSymbol;
  scope: RoomScope;
  onScope: (scope: RoomScope) => void;
}

/**
 * The sheet head's two Rooms: this Window's thread, or the ticker's standing one (`$TSLA`). Two segments in the
 * badge's own pill, so the head keeps the reference's shape and gains one choice.
 */
export function RoomSwitch({ symbol, scope, onScope }: RoomSwitchProps) {
  const segments: [RoomScope, string][] = [
    ["window", ROOM.ticker.window],
    ["ticker", ROOM.ticker.room(symbol)],
  ];
  return (
    <div className="room-switch" role="radiogroup" aria-label={ROOM.ticker.switchLabel}>
      {segments.map(([value, label]) => (
        <button key={value} type="button" role="radio" aria-checked={scope === value} data-on={scope === value} onClick={() => onScope(value)} data-cursor="hover">
          {label}
        </button>
      ))}
    </div>
  );
}
