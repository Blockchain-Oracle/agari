import { TICKERS } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import type { EventMarket } from "@agari/core/types";
import { useLanes, useOpeningPrice } from "@agari/markets/react";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useChartSeries } from "@/features/markets/hero/useChartSeries";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { TabScreen } from "~/components/shell/TabScreen";
import { WindowChart } from "~/components/window/WindowChart";
import { marketsEnv } from "~/lib/env";
import { FONT, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

/** Vertical live Window feed; every action opens the same native ticket as Markets. */
export default function ReelsScreen() {
  const { color } = useTheme();
  const { height } = useWindowDimensions();
  const reading = useLanes(marketsEnv.venueId ?? null);
  const nowMs = useChainNowMs();
  const nowSec = nowMs ? nowMs / 1000 : Date.now() / 1000;
  const windows = reading && isOk(reading)
    ? reading.value.lanes.flatMap((lane) => lane.markets).filter((market) => market.lockAtSec > nowSec).slice(0, 24)
    : [];
  const cardHeight = Math.max(480, height - 235);
  return <TabScreen>
    {windows.length ? <FlatList data={windows} keyExtractor={(market) => market.marketId} renderItem={({ item, index }) => <ReelWindow market={item} index={index} height={cardHeight} nowSec={nowSec} />} snapToInterval={cardHeight + 10} decelerationRate="fast" showsVerticalScrollIndicator={false} contentContainerStyle={styles.feed} ItemSeparatorComponent={() => <View style={{ height: 10 }} />} />
      : <View style={styles.empty}><Text style={[TYPE.headline, { color: color.ink }]}>{reading === null ? "Reading the live feed…" : reading.ok ? "Between Windows" : "Feed unavailable"}</Text><Text style={[TYPE.body, { color: color.inkSecondary }]}>Live Windows appear here when the venue lists them. Browse Markets for the full schedule.</Text><Pressable onPress={() => router.navigate("/markets")} accessibilityRole="link"><Text style={[TYPE.bodyStrong, { color: color.accent }]}>Go to Markets →</Text></Pressable></View>}
  </TabScreen>;
}

function ReelWindow({ market, index, height, nowSec }: { market: EventMarket; index: number; height: number; nowSec: number }) {
  const { color } = useTheme();
  const opening = useOpeningPrice(market.marketId);
  const series = useChartSeries(market);
  const openingRaw = opening && isOk(opening) ? opening.value : null;
  const points = series && isOk(series) ? series.value.points : [];
  const name = TICKERS[market.asset]?.name ?? market.asset;
  const seconds = Math.max(0, Math.ceil(market.lockAtSec - nowSec));
  const remaining = seconds > 3600 ? `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m` : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
  const pick = (dir: "up" | "down") => router.push({ pathname: "/ticket", params: { m: market.marketId, dir } });
  return <View style={[styles.card, { minHeight: height, backgroundColor: color.surface1, borderColor: color.hairline }]}>
    <View style={styles.top}><Text style={[styles.mono, { color: color.accent }]}>{String(index + 1).padStart(2, "0")} · LIVE WINDOW</Text><Text style={[styles.mono, { color: color.profit }]}>● {remaining}</Text></View>
    <View style={styles.asset}><AssetDisc asset={market.asset} size={44} /><View><Text style={[TYPE.title, { color: color.ink }]}>{name}</Text><Text style={[TYPE.caption, { color: color.inkMuted }]}>${market.asset} · {market.intervalSec / 60}m</Text></View></View>
    <Text style={[styles.question, { color: color.ink }]} numberOfLines={3}>{market.question}</Text>
    <View style={[styles.chart, { backgroundColor: color.surface2 }]}><WindowChart points={points} strikeRaw={openingRaw} height={180} />{points.length < 2 ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>Waiting for the live price line</Text> : null}</View>
    <Text style={[TYPE.caption, { color: color.inkSecondary }]}>The closing price decides. Review the quote and maximum loss in the ticket.</Text>
    <View style={styles.actions}><Pressable onPress={() => pick("up")} accessibilityRole="button" accessibilityLabel={`Call ${name} Up`} style={[styles.side, { backgroundColor: color.profit }]}><Text style={[TYPE.bodyStrong, { color: color.onAccent }]}>↑  Up</Text></Pressable><Pressable onPress={() => pick("down")} accessibilityRole="button" accessibilityLabel={`Call ${name} Down`} style={[styles.side, { backgroundColor: color.loss }]}><Text style={[TYPE.bodyStrong, { color: color.onAccent }]}>↓  Down</Text></Pressable></View>
    <Pressable onPress={() => router.push({ pathname: "/markets/[id]", params: { id: market.marketId } })} accessibilityRole="link" style={styles.detail}><Text style={[TYPE.caption, { color: color.accent }]}>Open full Window and source →</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  feed: { padding: SPACE.gutter, paddingBottom: 120 }, empty: { padding: SPACE.gutter, paddingTop: 72, gap: 18 },
  card: { borderRadius: RADIUS.lg, borderWidth: 1, padding: 20, gap: 16 }, top: { flexDirection: "row", justifyContent: "space-between" }, mono: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.2 },
  asset: { flexDirection: "row", alignItems: "center", gap: 12 }, question: { fontFamily: "Georgia", fontWeight: "700", fontSize: 32, lineHeight: 36, letterSpacing: -1.5 },
  chart: { borderRadius: RADIUS.md, padding: 7, minHeight: 194, justifyContent: "center" }, actions: { flexDirection: "row", gap: 10, marginTop: "auto" }, side: { flex: 1, height: 50, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" }, detail: { alignItems: "center", minHeight: 30 },
});
