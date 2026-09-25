import { countdown, type MarketPhase } from "@agari/core/lifecycle";
import type { EventMarket } from "@agari/core/types";
import { formatClock } from "@agari/core/units";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { laneAssetLabel, laneTabLabel } from "@/features/markets/lanes/lane-view";
import { HERO, SETTLING, TICKET } from "@/lib/copy";
import { FONT } from "~/theme";
import { TicketMiniChart } from "./TicketMiniChart";
import { useTk } from "./tk";

/**
 * web's `.tk-ticket--drawer` (TicketDock below 1024 px) in web's paper, one column at a 12 px gap: the head (which
 * Window, its phase, the clock, clear of the corner ✕) and the mini chart, then the composer's blocks. It rises in the
 * app's bottom drawer (the owner's call for a phone), which scrolls it and carries the ✕.
 */
export function TicketDrawer({ market, phase, nowMs, children }: { market: EventMarket; phase: MarketPhase | null; nowMs: number; children: ReactNode }) {
  return (
    <View style={styles.body}>
      <View style={styles.head}>
        <TicketHeader market={market} phase={phase} nowMs={nowMs} />
      </View>
      <TicketMiniChart market={market} />
      {children}
    </View>
  );
}

/** web's TicketHeader: "TSLAx · 5m · 24/7", the phase in words, and the clock to the bell (vermilion once urgent). */
function TicketHeader({ market, phase, nowMs }: { market: EventMarket; phase: MarketPhase | null; nowMs: number }) {
  const tk = useTk();
  const state = nowMs > 0 ? countdown(nowMs, market.expirySec, market.intervalSec) : null;
  return (
    <View style={styles.header}>
      <View style={styles.names}>
        <Text style={[styles.title, { color: tk.ink }]} numberOfLines={1}>
          {laneAssetLabel(market.asset, market.lane)} · {laneTabLabel(market.lane, market.intervalSec)}
        </Text>
        <Text style={[styles.caption, { color: tk.inkSecondary }]}>{phase ? HERO.phase[phase] : TICKET.syncing}</Text>
      </View>
      <Text style={[styles.clock, { color: state?.urgent ? tk.vermilion : tk.ink }]} accessibilityRole="timer">
        {state ? (state.settling ? SETTLING : formatClock(state.remainingSec)) : "–:––"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12 },
  head: { paddingRight: 48, marginBottom: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  names: { flexShrink: 1, gap: 2 },
  title: { fontFamily: FONT.heading, fontSize: 18, lineHeight: 23.4 },
  caption: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85 },
  clock: { fontFamily: FONT.dataStrong, fontSize: 20, lineHeight: 24, fontVariant: ["tabular-nums"] },
});
