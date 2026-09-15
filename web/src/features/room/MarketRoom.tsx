"use client";

import { isTickerSymbol, type TickerSymbol } from "@agari/core/market";
import type { MarketId } from "@agari/core/types";
import { useMarket } from "@agari/markets/react";
import React, { useState, type ReactNode } from "react";
import { CommentRoom } from "./CommentRoom";
import { ROOM } from "./copy";
import { tickerRoomId, type RoomId } from "./room-id";
import { RoomSwitch, type RoomScope } from "./RoomSwitch";
import { useRoom } from "./useRoom";

interface MarketRoomProps {
  marketId: MarketId;
  /** The call this Room is about, e.g. "BTC holds above $77,027? · 5m". */
  callLabel: string;
  onClose: () => void;
  /** Jump the reader to placing a bet, which is what unlocks the Room. */
  onBet?: () => void;
  /** The Window's ticker, when the caller already has it; otherwise it is read from the index. */
  asset?: string;
}

export interface RoomSheetProps {
  roomId: RoomId;
  callLabel: string;
  onClose: () => void;
  onBet?: () => void;
  ticker?: TickerSymbol | null;
  switcher?: ReactNode;
}

interface BoundaryProps {
  fallback: (error: Error) => React.ReactNode;
  children: React.ReactNode;
}

/**
 * The Room touches the wallet, a signature prompt and the network, any of which can
 * throw in ways that vary by wallet and cannot all be reproduced headlessly. So the
 * whole thing sits behind a boundary — the reference's own reasoning, kept: if
 * anything in the Room throws, a contained sheet appears with the error, and the
 * rest of the page keeps working. Never a full-page crash over a comment thread.
 */
class RoomErrorBoundary extends React.Component<BoundaryProps, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[room] crashed:", error?.message, "\n", error?.stack, "\n", info?.componentStack);
  }

  render() {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children;
  }
}

function RoomInner({ roomId, callLabel, onClose, onBet, ticker, switcher }: RoomSheetProps) {
  const room = useRoom(roomId, true);
  return (
    <CommentRoom
      callLabel={callLabel}
      gate={room.gate}
      comments={room.comments}
      busy={room.busy}
      error={room.error}
      onClose={onClose}
      onJoin={() => void room.join()}
      onPost={(body) => void room.post(body)}
      onBet={onBet}
      ticker={ticker}
      switcher={switcher}
    />
  );
}

/** Shown if the Room throws: contained, the page stays alive, the error surfaced. */
function RoomFallback({ callLabel, onClose, error }: { callLabel: string; onClose: () => void; error: Error }) {
  return (
    <CommentRoom
      callLabel={callLabel}
      gate="unavailable"
      comments={[]}
      busy={false}
      error={String(error?.message ?? error).slice(0, 300)}
      onClose={onClose}
      onJoin={() => undefined}
      onPost={() => undefined}
    />
  );
}

/** Self-contained mount of one Room — a Window's or a ticker's. */
export function RoomSheet(props: RoomSheetProps) {
  return (
    <RoomErrorBoundary fallback={(error) => <RoomFallback callLabel={props.callLabel} onClose={props.onClose} error={error} />}>
      <RoomInner {...props} />
    </RoomErrorBoundary>
  );
}

/**
 * A Window's Room, with its ticker's standing Room one tap away in the head ("This Window · $TSLA").
 * The ticker comes from the caller or from the Window's index row, so no chain read is added.
 */
export function MarketRoom({ marketId, callLabel, onClose, onBet, asset }: MarketRoomProps) {
  const market = useMarket(asset === undefined ? marketId : null);
  const symbol = asset ?? (market?.ok ? market.value?.asset : undefined);
  const ticker = isTickerSymbol(symbol) ? symbol : null;
  const [scope, setScope] = useState<RoomScope>("window");
  const inTicker = scope === "ticker" && ticker !== null;

  return (
    <RoomSheet
      roomId={inTicker ? tickerRoomId(ticker) : marketId}
      callLabel={inTicker ? ROOM.ticker.title(ticker) : callLabel}
      onClose={onClose}
      onBet={onBet}
      ticker={inTicker ? ticker : null}
      switcher={ticker ? <RoomSwitch symbol={ticker} scope={scope} onScope={setScope} /> : null}
    />
  );
}

export const ROOM_LABEL = ROOM.eyebrow;
