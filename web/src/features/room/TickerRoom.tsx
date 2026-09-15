"use client";

import type { TickerSymbol } from "@agari/core/market";
import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROOM } from "./copy";
import { RoomSheet } from "./MarketRoom";
import { tickerRoomId } from "./room-id";

/**
 * A ticker's standing Room (`$TSLA`), opened from anywhere that talks about the stock — the ticker hub first.
 *
 * The trigger is the hero foot's Room control (`.mh-room`: mono caps, icon, "bettors only" a step quieter), so it
 * reads as the same door. Anyone who ever traded a Window of the ticker gets in; "place a bet" goes to the markets.
 */
export function TickerRoomButton({ symbol }: { symbol: TickerSymbol }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="mh-room" onClick={() => setOpen(true)} data-cursor="hover">
        <MessageCircle className="mh-room-icon" aria-hidden />
        {ROOM.ticker.open(symbol)}
        <span className="mh-room-meta">{ROOM.qualifier}</span>
      </button>
      {open && (
        <RoomSheet
          roomId={tickerRoomId(symbol)}
          callLabel={ROOM.ticker.title(symbol)}
          ticker={symbol}
          onClose={() => setOpen(false)}
          onBet={() => {
            setOpen(false);
            router.push("/markets");
          }}
        />
      )}
    </>
  );
}
