import { TICKERS } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import type { EventMarket, Lane } from "@agari/core/types";
import { useLanes } from "@agari/markets/react";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { TabScreen } from "~/components/shell/TabScreen";
import { marketsEnv } from "~/lib/env";
import { FONT, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

const laneKey = (lane: Lane) => `${lane.basis}:${lane.intervalSec}`;
const laneTitle = (lane: Lane) => `${lane.basis === "token" ? "24/7" : lane.basis === "regular" ? "Stock" : "Gap"} · ${lane.label}`;
const SOURCE: Record<NonNullable<EventMarket["printSource"]>, string> = {
  pyth: "Pyth verified print", redstone: "RedStone print", switchboard: "Switchboard print", attested: "Venue-attested print",
};
function timeLeft(lockAtSec: number, nowSec: number): string {
  const seconds = Math.max(0, Math.ceil(lockAtSec - nowSec));
  if (!seconds) return "Closed";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${String(minutes).padStart(2, "0")}m left` : `${minutes}m ${String(seconds % 60).padStart(2, "0")}s left`;
}

/** Live Window identities and price sources come from the same venue read as web. */
export default function MarketsScreen() {
  const { color } = useTheme();
  const reading = useLanes(marketsEnv.venueId ?? null);
  const nowMs = useChainNowMs();
  const [chosen, setChosen] = useState<string | null>(null);
  const lanes = reading && isOk(reading) ? reading.value.lanes.filter((lane) => lane.markets.length) : [];
  const selected = useMemo(() => lanes.find((lane) => laneKey(lane) === chosen) ?? lanes.find((lane) => lane.basis === "token") ?? lanes[0], [lanes, chosen]);
  const markets = selected?.markets ?? [];
  const featured = markets.find((market) => market.asset === "AILABS") ?? markets[0];
  const rest = markets.filter((market) => market.marketId !== featured?.marketId);
  const nowSec = nowMs ? nowMs / 1000 : Date.now() / 1000;

  return <TabScreen><ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.body}>
    <View style={styles.intro}>
      <Text style={[styles.eyebrow, { color: color.accent }]}>SOLANA STOCK MARKETS</Text>
      <Text style={[styles.title, { color: color.ink }]}>Find your Window.</Text>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>Make a call on the next move. Read the rule and the price source before you sign.</Text>
      <View style={[styles.meta, { borderTopColor: color.hairline }]}><Text style={[styles.mono, { color: color.profit }]}>● LIVE VENUE</Text><Text style={[styles.mono, { color: color.inkMuted }]}>SOLANA DEVNET · TEST FUNDS</Text></View>
    </View>
    {reading === null ? <StateCard title="Loading live Windows" line="Reading the venue and its current price windows." /> : !reading.ok ? <StateCard title="Markets are unavailable" line="The live venue did not answer. Reopen this tab to retry." /> : !selected ? <StateCard title="Between Windows" line="The next Window will appear when the venue lists it." /> : <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lanes} accessibilityLabel="Market lanes">
        {lanes.map((lane) => { const active = laneKey(lane) === laneKey(selected); return <Pressable key={laneKey(lane)} onPress={() => setChosen(laneKey(lane))} accessibilityRole="tab" accessibilityState={{ selected: active }} style={[styles.lane, { backgroundColor: active ? color.ink : color.surface1, borderColor: active ? color.ink : color.hairline }]}><Text style={[styles.laneText, { color: active ? color.ground : color.ink }]}>{laneTitle(lane)}</Text></Pressable>; })}
      </ScrollView>
      <View style={styles.section}><View style={styles.sectionHead}><Text style={[styles.mono, { color: color.inkMuted }]}>01 · FEATURED WINDOW</Text><Text style={[styles.mono, { color: color.inkMuted }]}>{markets.length} LISTED</Text></View>{featured ? <WindowCard market={featured} nowSec={nowSec} featured /> : null}</View>
      {rest.length ? <View style={styles.section}><View style={styles.sectionHead}><Text style={[styles.mono, { color: color.inkMuted }]}>02 · MORE WINDOWS</Text><Text style={[styles.mono, { color: color.inkMuted }]}>SAME LANE</Text></View>{rest.map((market) => <WindowCard key={market.marketId} market={market} nowSec={nowSec} />)}</View> : null}
    </>}
  </ScrollView></TabScreen>;
}

function WindowCard({ market, nowSec, featured = false }: { market: EventMarket; nowSec: number; featured?: boolean }) {
  const { color } = useTheme();
  const name = TICKERS[market.asset]?.name ?? market.asset;
  const active = market.tradingStartSec <= nowSec && market.lockAtSec > nowSec;
  const opens = market.tradingStartSec > nowSec;
  const state = opens ? "UP NEXT" : active ? "OPEN FOR CALLS" : "WINDOW CLOSED";
  return <Pressable onPress={() => router.push({ pathname: "/markets/[id]", params: { id: market.marketId } })} accessibilityRole="link" accessibilityLabel={`Open ${name} Window, ${timeLeft(market.lockAtSec, nowSec)}`} style={({ pressed }) => [styles.card, featured && styles.featured, { backgroundColor: color.surface1, borderColor: color.hairline, opacity: pressed ? 0.8 : 1 }]}>
    <View style={styles.cardTop}><Text style={[styles.mono, { color: color.accent }]}>{market.lane === "token" ? "24/7 · PRESTOCKS & TOKENS" : market.lane === "gap" ? "MARKET GAP" : "STOCK MARKET"}</Text><Text style={[styles.mono, { color: active ? color.profit : color.inkMuted }]}>{active ? "● " : ""}{state}</Text></View>
    <View style={styles.asset}><AssetDisc asset={market.asset} size={featured ? 44 : 36} /><View style={styles.assetCopy}><Text style={[featured ? styles.featuredName : TYPE.title, { color: color.ink }]} numberOfLines={1}>{name}</Text><Text style={[TYPE.caption, { color: color.accent }]}>${market.asset} · {market.intervalSec >= 3600 ? `${market.intervalSec / 3600}h` : `${market.intervalSec / 60}m`} Window</Text></View><Text style={[styles.arrow, { color: color.accent }]}>↗</Text></View>
    {featured ? <Text style={[TYPE.body, { color: color.inkSecondary }]} numberOfLines={2}>{market.question}</Text> : null}
    <View style={[styles.cardBottom, { borderTopColor: color.hairline }]}><Text style={[TYPE.caption, styles.source, { color: color.inkSecondary }]} numberOfLines={1}>{market.printSource ? SOURCE[market.printSource] : "Source shown in Window"}</Text><Text style={[styles.time, { color: active ? color.ink : color.inkMuted }]}>{opens ? "Not open yet" : timeLeft(market.lockAtSec, nowSec)}</Text></View>
    {featured ? <View style={[styles.viewButton, { backgroundColor: color.accent }]}><Text style={[TYPE.bodyStrong, { color: color.onAccent }]}>View Window</Text><Text style={[styles.arrow, { color: color.onAccent }]}>→</Text></View> : null}
  </Pressable>;
}

function StateCard({ title, line }: { title: string; line: string }) { const { color } = useTheme(); return <View style={[styles.card, styles.stateCard, { backgroundColor: color.surface1, borderColor: color.hairline }]}><Text style={[TYPE.title, { color: color.ink }]}>{title}</Text><Text style={[TYPE.body, { color: color.inkSecondary }]}>{line}</Text></View>; }

const styles = StyleSheet.create({
  body: { paddingBottom: 130, gap: 22 }, intro: { paddingHorizontal: SPACE.gutter, paddingTop: 28, gap: 11 },
  eyebrow: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 3 }, title: { fontFamily: "Georgia", fontWeight: "700", fontSize: 39, lineHeight: 43, letterSpacing: -2 },
  meta: { borderTopWidth: 1, marginTop: 10, paddingTop: 13, flexDirection: "row", justifyContent: "space-between" }, mono: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 0.8 },
  lanes: { paddingHorizontal: SPACE.gutter, gap: 8 }, lane: { borderWidth: 1, minHeight: 38, borderRadius: RADIUS.full, paddingHorizontal: 15, justifyContent: "center" }, laneText: { fontFamily: FONT.bodyStrong, fontSize: 13 },
  section: { paddingHorizontal: SPACE.gutter, gap: 10 }, sectionHead: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 5 },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 16, gap: 13 }, featured: { padding: 19, gap: 18 }, cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  asset: { flexDirection: "row", alignItems: "center", gap: 12 }, assetCopy: { flex: 1, gap: 2 }, featuredName: { fontFamily: FONT.headingHeavy, fontSize: 24, lineHeight: 27 }, arrow: { fontFamily: FONT.body, fontSize: 21 },
  cardBottom: { borderTopWidth: 1, paddingTop: 12, flexDirection: "row", justifyContent: "space-between", gap: 10 }, source: { flex: 1 }, time: { fontFamily: FONT.data, fontSize: 11 }, viewButton: { borderRadius: RADIUS.md, height: 44, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stateCard: { marginHorizontal: SPACE.gutter, marginTop: 10 },
});
