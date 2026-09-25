import { isRestable } from "@agari/core/lifecycle";
import { isOk } from "@agari/core/schemas";
import type { EventMarket, MarketId, Side } from "@agari/core/types";
import { useMarket } from "@agari/markets/react";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { defaultSide, useBetAgainst } from "@/features/markets/bet-against";
import { useWindowPhase } from "@/features/markets/ticket/useTicket";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { EmptyState, ErrorState, LoadingState } from "~/components/portfolio/web/states";
import { ScheduleTicket } from "~/features/markets/ticket/ScheduleTicket";
import { Ticket } from "~/features/markets/ticket/Ticket";
import { TicketFrame } from "~/features/markets/ticket/TicketFrame";

/** A deep link to a Window the index no longer holds: said, with the way back. */
const GONE = { why: "Window not found", back: "Back to Markets" } as const;

/**
 * web's TicketDock below 1024 px — the right-edge drawer over whatever opened it (the route is a clear modal): `?m=<marketId>&dir=up|down`. A Regular or Gap
 * Window listed before its bell takes a scheduled call at the user's own price (D-088); anything else is the taker's
 * Ticket at the live book.
 */
export default function TicketRoute() {
  return (
    <TicketFrame>
      <TicketContent />
    </TicketFrame>
  );
}

function TicketContent() {
  const { m, dir } = useLocalSearchParams<{ m: string; dir?: Side }>();
  const reading = useMarket(m as MarketId);
  // A Window the ticket advances to (no-entry buffer) is read afresh; the one in hand stays mounted meanwhile, so the
  // side and the stake carry over as web's ticket keeps them.
  const held = useRef<EventMarket | null>(null);
  const read = reading && isOk(reading) ? reading.value : null;
  if (read) held.current = read;
  const market = read ?? held.current;
  if (!market) {
    return (
      <View style={styles.holding}>
        {reading === null ? <LoadingState shape="ticket" /> : !reading.ok ? <ErrorState diagnosis={reading.error} /> : <EmptyState why={GONE.why} nextAction={{ label: GONE.back, onPress: () => router.navigate("/markets") }} />}
      </View>
    );
  }
  return <TicketBody market={market} dir={dir ?? null} />;
}

/** web's TicketBody: which composer the Window takes; the token lane lists two minutes ahead and keeps the taker's words. */
function TicketBody({ market, dir }: { market: EventMarket; dir: Side | null }) {
  const nowMs = useChainNowMs();
  const betAgainst = useBetAgainst();
  // Every opening of the drawer is a new session (web's `sessionId`): a stake preset left for this Window is taken once.
  const [sessionId] = useState(() => Date.now());
  const phase = useWindowPhase(market, nowMs);
  const side = dir ?? defaultSide(betAgainst) ?? null;
  const selection = { marketId: market.marketId, side, market, nowMs, resolving: false, sessionId };
  const schedules = phase !== null && isRestable(phase) && market.lane !== "token";
  return schedules ? <ScheduleTicket selection={selection} /> : <Ticket selection={selection} />;
}

const styles = StyleSheet.create({
  holding: { flex: 1, padding: 24 },
});
