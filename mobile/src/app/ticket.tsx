import { isRestable } from "@agari/core/lifecycle";
import { isOk } from "@agari/core/schemas";
import type { EventMarket, MarketId, Side } from "@agari/core/types";
import { useMarket } from "@agari/markets/react";
import { router, useLocalSearchParams } from "expo-router";
import { X } from "lucide-react-native";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { TICKET } from "@/lib/copy";
import { defaultSide, useBetAgainst } from "@/features/markets/bet-against";
import { useWindowPhase } from "@/features/markets/ticket/useTicket";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { BottomDrawer, useDrawerClose } from "~/components/drawer/BottomDrawer";
import { EmptyState, ErrorState, LoadingState } from "~/components/portfolio/web/states";
import { ScheduleTicket } from "~/features/markets/ticket/ScheduleTicket";
import { Ticket } from "~/features/markets/ticket/Ticket";
import { useTk } from "~/features/markets/ticket/tk";

/** A deep link to a Window the index no longer holds: said, with the way back. */
const GONE = { why: "Window not found", back: "Back to Markets" } as const;

/**
 * web's TicketDock below 1024 px, as the app's bottom drawer over whatever opened it (the owner's call for a phone; web's
 * paper, rule and ✕): `?m=<marketId>&dir=up|down`. A Regular or Gap
 * Window listed before its bell takes a scheduled call at the user's own price (D-088); anything else is the taker's
 * Ticket at the live book.
 */
export default function TicketRoute() {
  const tk = useTk();
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/markets"));
  return (
    <BottomDrawer onClose={leave} background={tk.drawerBg} border={tk.drawerEdge} contentStyle={styles.panel} closeLabel={TICKET.close} maxHeight={0.92} corner={<Close />}>
      <TicketContent />
    </BottomDrawer>
  );
}

/** `.tk-drawer-close`: the ✕ in the corner, gray-600, slides the drawer away. */
function Close() {
  const tk = useTk();
  const close = useDrawerClose();
  return (
    <Pressable onPress={() => close()} accessibilityRole="button" accessibilityLabel={TICKET.close} hitSlop={6} style={styles.close}>
      <X size={16} color={tk.close} />
    </Pressable>
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
      <View>
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
  // `.tk-drawer`'s 24 px, under the drawer's handle.
  panel: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  close: { padding: 8, borderRadius: 999 },
});
