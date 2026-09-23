import { BASKETS, BASKET_SYMBOLS, type BasketSymbol } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import type { EventMarket } from "@agari/core/types";
import { useAssetPrice, useLanes } from "@agari/markets/react";
import { router, Stack } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { basisRaw, feedRawToOracleRaw, pointsLine } from "@/features/markets/hero/units";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { marketsEnv } from "~/lib/env";
import { FONT, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

/** The registry, live basket feed and listed Window form one native prediction journey. */
export default function BasketsScreen() {
  const { color } = useTheme();
  const reading = useLanes(marketsEnv.venueId ?? null);
  const nowMs = useChainNowMs();
  const markets = reading && isOk(reading) ? reading.value.lanes.flatMap((lane) => lane.markets) : [];
  return <>
    <Stack.Screen options={{ title: "Baskets", headerShown: true }} />
    <ScrollView style={{ backgroundColor: color.ground }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.body}>
      <Text style={[styles.kicker, { color: color.accent }]}>PRE-IPO · 24/7</Text>
      <Text style={[TYPE.display, { color: color.ink }]}>Baskets.</Text>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>Groups of PreStocks names settle as equal-weight indices based at 1,000 points. Open a live Window to inspect its price source, rule and ticket.</Text>
      {reading === null ? <Text style={[TYPE.body, { color: color.inkSecondary }]}>Reading listed basket Windows…</Text> : !reading.ok ? <Text style={[TYPE.body, { color: color.loss }]}>The venue did not answer. Basket Windows are unavailable right now.</Text> : null}
      {BASKET_SYMBOLS.map((symbol) => <BasketRow key={symbol} symbol={symbol} markets={markets} nowMs={nowMs} />)}
    </ScrollView>
  </>;
}

function BasketRow({ symbol, markets, nowMs }: { symbol: BasketSymbol; markets: EventMarket[]; nowMs: number }) {
  const { color } = useTheme();
  const basket = BASKETS[symbol];
  const price = useAssetPrice(symbol);
  const point = price && isOk(price) ? price.value : null;
  const fresh = point && nowMs > 0 && nowMs - point.publishTimeSec * 1000 < 60_000;
  const index = point && fresh ? pointsLine(feedRawToOracleRaw(basisRaw(point), point.decimals)) : null;
  const window = markets.filter((m) => m.asset === symbol && m.lane === "token" && m.tradingStartSec * 1000 <= nowMs && m.lockAtSec * 1000 > nowMs).sort((a, b) => b.expirySec - a.expirySec)[0];
  return <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
    <View style={styles.head}><AssetDisc asset={symbol} size={42} /><View style={styles.headText}><Text style={[TYPE.title, { color: color.ink }]}>{basket.name}</Text><Text style={[TYPE.caption, { color: color.accent }]}>${symbol} · {basket.members.length} members</Text></View></View>
    <Text style={[TYPE.body, { color: color.inkSecondary }]}>{basket.blurb}</Text>
    <Text style={[TYPE.caption, { color: color.inkMuted }]}>{basket.members.map((m) => m.symbol).join("  ·  ")}</Text>
    <View style={[styles.index, { borderTopColor: color.hairline }]}><View><Text style={[styles.kicker, { color: color.inkMuted }]}>INDEX · FEED READING</Text><Text style={[TYPE.dataLg, { color: color.ink }]}>{index ?? "—"}</Text></View><Text style={[TYPE.caption, { color: fresh ? color.profit : color.inkMuted }]}>{fresh ? "Live" : "Awaiting fresh read"}</Text></View>
    {window ? <Pressable onPress={() => router.push({ pathname: "/markets/[id]", params: { id: window.marketId } })} accessibilityRole="link" style={[styles.action, { backgroundColor: color.accent }]}><Text style={[TYPE.bodyStrong, { color: color.onAccent }]}>Open live Window</Text><Text style={[TYPE.bodyStrong, { color: color.onAccent }]}>→</Text></Pressable> : <Text style={[TYPE.caption, { color: color.inkMuted }]}>No basket Window is open for calls right now.</Text>}
  </View>;
}

const styles = StyleSheet.create({ body: { padding: SPACE.gutter, paddingTop: 24, paddingBottom: 90, gap: 16 }, kicker: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.5 }, card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 17, gap: 14 }, head: { flexDirection: "row", alignItems: "center", gap: 12 }, headText: { gap: 3 }, index: { borderTopWidth: 1, paddingTop: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, action: { minHeight: 48, borderRadius: RADIUS.md, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" } });
