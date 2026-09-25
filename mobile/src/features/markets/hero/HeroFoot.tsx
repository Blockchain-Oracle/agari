import type { TickerSymbol } from "@agari/core/market";
import type { MarketId } from "@agari/core/types";
import { useLanes } from "@agari/markets/react";
import { LinearGradient } from "expo-linear-gradient";
import { MessageCircle } from "lucide-react-native";
import { useMemo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TopOfBook } from "@/features/markets/hero/useTopOfBook";
import { nextListedWindow } from "@/features/markets/lanes/next-window";
import type { MarketSession } from "@/features/markets/session/useMarketSession";
import { useVenue } from "@/features/markets/useVenue";
import { formatCadence, HERO_HEAD, PREOPEN } from "@/lib/copy";
import { useWhen } from "@/lib/when";
import { haptic } from "~/components/kit";
import { mkType, useMk } from "./mk";
import { PriceAlerts } from "./PriceAlerts";

/** `.hero-chart-foot`: a mono 10 px band under the canvas, on its own wash and hairline. */
export function FootBand({ children }: { children: ReactNode }) {
  const mk = useMk();
  return <View style={[styles.foot, { backgroundColor: mk.footBg, borderTopColor: mk.footRule }]}>{children}</View>;
}

/**
 * web's HeroChartFoot on a phone: the Room and the price alert on the left (the Room's "bettors only" qualifier drops
 * below 480 px), the UP ramp on the right — the fill is the UP price, "—" with no resting offer.
 */
export function LiveFoot({ book, asset, currentRaw, onOpenRoom }: { book: TopOfBook; asset: string; currentRaw: bigint | null; onOpenRoom: () => void }) {
  const mk = useMk();
  const cents = book.upCents;
  return (
    <FootBand>
      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            haptic.tap();
            onOpenRoom();
          }}
          accessibilityRole="button"
          accessibilityLabel={`${HERO_HEAD.room} · ${HERO_HEAD.roomQualifier}`}
          hitSlop={10}
          style={styles.room}
        >
          <MessageCircle size={12} color={mk.footAction} strokeWidth={2} />
          <Text style={[mkType.action, { color: mk.footAction }]}>{HERO_HEAD.room}</Text>
        </Pressable>
        <PriceAlerts asset={asset} currentRaw={currentRaw} />
      </View>
      <View style={styles.ramp}>
        <Text style={[mkType.foot, { color: mk.gray500 }]}>{HERO_HEAD.rampUp}</Text>
        <View style={[styles.bar, { backgroundColor: mk.rampBar }]}>
          {cents !== null ? <LinearGradient colors={[mk.rampFrom, mk.rampTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fill, { width: `${cents}%` }]} /> : null}
        </View>
        <Text style={[mkType.foot, { color: mk.vermilion }]}>{cents === null ? HERO_HEAD.noPrice : `${cents}¢`}</Text>
      </View>
    </FootBand>
  );
}

/**
 * web's ScheduleCallButton in its `foot` variant (D-088): "Schedule a call" on the asset's next listed Regular Window
 * in the Room's grammar, with which Window it is; while nothing is listed, the line that says when one will be.
 */
export function ScheduleSeam({ asset, session, nowSec, onSelect, opensSec }: { asset: TickerSymbol; session: MarketSession | null; nowSec: number; onSelect: (marketId: MarketId) => void; opensSec: number | null }) {
  const mk = useMk();
  const when = useWhen();
  const { venueId } = useVenue();
  const lanes = useLanes(venueId);
  const laneSet = lanes?.ok ? lanes.value : null;
  const next = useMemo(() => nextListedWindow(laneSet, asset, nowSec), [laneSet, asset, nowSec]);
  if (lanes === null) return null;
  if (next) {
    const cadence = formatCadence(next.intervalSec);
    return (
      <Pressable
        onPress={() => {
          haptic.tap();
          onSelect(next.marketId);
        }}
        accessibilityRole="button"
        accessibilityLabel={PREOPEN.seam.aria(asset, cadence, when(next.tradingStartSec))}
        hitSlop={8}
        style={styles.room}
      >
        <Text style={[mkType.action, { color: mk.footAction }]}>
          {PREOPEN.seam.cta} <Text style={{ color: mk.roomMeta }}>{PREOPEN.seam.which(cadence, when(next.tradingStartSec))}</Text>
        </Text>
      </Pressable>
    );
  }
  const closesAt = session?.open ? session.status.closesAtSec : null;
  const line = closesAt !== null && closesAt !== undefined ? PREOPEN.seam.listsAtClose(when(closesAt, { clock: true })) : opensSec ? PREOPEN.seam.listsBeforeOpen(when(opensSec)) : null;
  if (line === null) return null;
  return <Text style={[mkType.foot, { color: mk.gray600 }]}>{line}</Text>;
}

const styles = StyleSheet.create({
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderTopWidth: 1 },
  actions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 14 },
  room: { flexDirection: "row", alignItems: "center", gap: 6 },
  ramp: { flexDirection: "row", alignItems: "center", gap: 8 },
  bar: { width: 100, height: 3, borderRadius: 999, overflow: "hidden" },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0 },
});
