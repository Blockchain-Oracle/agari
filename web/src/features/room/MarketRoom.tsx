"use client";

import type { MarketId } from "@masayume/core/types";
import React from "react";
import { CommentRoom } from "./CommentRoom";
import { ROOM } from "./copy";
import { useRoom } from "./useRoom";

interface MarketRoomProps {
  marketId: MarketId;
  /** The call this Room is about, e.g. "BTC holds above $77,027? · 5m". */
  callLabel: string;
  onClose: () => void;
  /** Jump the reader to placing a bet, which is what unlocks the Room. */
  onBet?: () => void;
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

function RoomInner({ marketId, callLabel, onClose, onBet }: MarketRoomProps) {
  const room = useRoom(marketId, true);
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

/** Self-contained mount of the Room for one market. */
export function MarketRoom(props: MarketRoomProps) {
  return (
    <RoomErrorBoundary fallback={(error) => <RoomFallback callLabel={props.callLabel} onClose={props.onClose} error={error} />}>
      <RoomInner {...props} />
    </RoomErrorBoundary>
  );
}

export const ROOM_LABEL = ROOM.eyebrow;
