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
import { EmptyState, ErrorState, LoadingState } from "~/components/kit";
import { NATIVE_MARKETS } from "~/features/markets/copy";
import { ScheduleTicket } from "~/features/markets/ticket/ScheduleTicket";
import { TakerTicket } from "~/features/markets/ticket/TakerTicket";
import { SPACE, useTheme } from "~/theme";

/**
 * The Ticket as a sheet over whatever opened it (web's TicketDock drawer): `?m=<marketId>&dir=up|down`. A Regular or
 * Gap Window listed before its bell takes a scheduled call at the user's own price (the limit order, D-088); anything
 * else is the taker's ticket at the live book.
 */
export default function TicketSheet() {
  const { color } = useTheme();
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
      <View collapsable={false} style={[styles.holding, { backgroundColor: color.ground }]}>
        {reading === null ? <LoadingState shape="plate" /> : !reading.ok ? <ErrorState diagnosis={reading.error} /> : <EmptyState why={NATIVE_MARKETS.windowGone} action={{ label: NATIVE_MARKETS.backToMarkets, onPress: () => router.navigate("/markets") }} />}
      </View>
    );
  }
  return <TicketBody market={market} dir={dir ?? null} />;
}

function TicketBody({ market, dir }: { market: EventMarket; dir: Side | null }) {
  const nowMs = useChainNowMs();
  const betAgainst = useBetAgainst();
  // Every opening of the sheet is a new session (web's `sessionId`): a stake preset left for this Window is taken once.
  const [sessionId] = useState(() => Date.now());
  const phase = useWindowPhase(market, nowMs);
  const side = dir ?? defaultSide(betAgainst) ?? null;
  const selection = { marketId: market.marketId, side, market, nowMs, resolving: false, sessionId };
  const schedules = phase !== null && isRestable(phase) && market.lane !== "token";
  return schedules ? <ScheduleTicket selection={selection} /> : <TakerTicket selection={selection} />;
}

const styles = StyleSheet.create({
  holding: { flex: 1, padding: SPACE.gutter, paddingTop: 28 },
});
