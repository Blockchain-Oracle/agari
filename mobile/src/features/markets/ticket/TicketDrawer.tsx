import { countdown, type MarketPhase } from "@agari/core/lifecycle";
import type { EventMarket } from "@agari/core/types";
import { formatClock } from "@agari/core/units";
import { router } from "expo-router";
import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { laneAssetLabel, laneTabLabel } from "@/features/markets/lanes/lane-view";
import { HERO, SETTLING, TICKET } from "@/lib/copy";
import { FONT } from "~/theme";
import { SheetToasts } from "./SheetToasts";
import { TicketMiniChart } from "./TicketMiniChart";
import { useTk } from "./tk";
import { useClampedScroll } from "./useClampedScroll";

/**
 * web's `.tk-drawer` holding a `.tk-ticket--drawer` (TicketDock below 1024 px): the panel is the surface, 24 px in, one
 * column at a 12 px gap; the close in the corner, the head (which Window, its phase, the clock) and the mini chart,
 * then the composer's blocks. Presented over whatever opened it, it closes back to it.
 */
export function TicketDrawer({ market, phase, nowMs, children }: { market: EventMarket; phase: MarketPhase | null; nowMs: number; children: ReactNode }) {
  const tk = useTk();
  const scroll = useClampedScroll();
  return (
    // The sheet lays out a ScrollView beside at most one sibling (react-native-screens): it stays a real view.
    <View collapsable={false} style={[styles.fill, { backgroundColor: tk.drawerBg }]}>
      <ScrollView {...scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.head}>
          <TicketHeader market={market} phase={phase} nowMs={nowMs} />
        </View>
        <TicketMiniChart market={market} />
        {children}
        <SheetToasts />
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={TICKET.close} hitSlop={6} style={styles.close}>
          <X size={16} color={tk.close} />
        </Pressable>
      </ScrollView>
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
  fill: { flex: 1 },
  body: { padding: 24, paddingBottom: 40, gap: 12 },
  close: { position: "absolute", top: 40, right: 40, padding: 8, borderRadius: 999 },
  head: { paddingRight: 48, marginBottom: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  names: { flexShrink: 1, gap: 2 },
  title: { fontFamily: FONT.heading, fontSize: 18, lineHeight: 23.4 },
  caption: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85 },
  clock: { fontFamily: FONT.dataStrong, fontSize: 20, lineHeight: 24, fontVariant: ["tabular-nums"] },
});
