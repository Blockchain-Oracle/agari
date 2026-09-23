import { isOk } from "@agari/core/schemas";
import type { MarketId, Side } from "@agari/core/types";
import { useMarket, useOpeningPrice } from "@agari/markets/react";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { assetPriceLine } from "@/features/markets/hero/units";
import { useChartSeries } from "@/features/markets/hero/useChartSeries";
import { useOracleSpot } from "@/features/markets/hero/useOracleSpot";
import { useTopOfBook } from "@/features/markets/hero/useTopOfBook";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { formatCadence } from "@/lib/copy";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { CountdownRing } from "~/components/ui/CountdownRing";
import { SideButtons } from "~/components/window/SideButtons";
import { WindowChart } from "~/components/window/WindowChart";
import { WindowQuestion } from "~/components/window/WindowQuestion";
import { SPACE, TYPE, useTheme } from "~/theme";

/** One Window: the question, the live price and line against the strike, the clock, and the two calls. */
export default function WindowScreen() {
  const { color } = useTheme();
  const { id } = useLocalSearchParams<{ id: string; dir?: Side }>();
  const reading = useMarket(id as MarketId);
  const market = reading && isOk(reading) ? reading.value : null;
  const opening = useOpeningPrice(market?.marketId ?? null);
  const openingRaw = opening && isOk(opening) ? opening.value : null;
  const spot = useOracleSpot(market?.asset ?? null);
  const series = useChartSeries(market);
  const book = useTopOfBook(market);
  const nowMs = useChainNowMs();
  if (!market) return <View style={[styles.fill, { backgroundColor: color.ground }]} />;

  const nowSec = nowMs > 0 ? nowMs / 1000 : Date.now() / 1000;
  const remaining = Math.max(0, market.lockAtSec - nowSec);
  const points = series && isOk(series) ? series.value.points : [];
  const pick = (side: Side) => router.push({ pathname: "/ticket", params: { m: market.marketId, dir: side } });

  return (
    <>
      <Stack.Screen options={{ headerTitle: () => <WindowTitle asset={market.asset} cadence={formatCadence(market.intervalSec)} />, headerLeft: undefined, unstable_headerLeftItems: undefined }} />
      <ScrollView style={{ backgroundColor: color.ground }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.body}>
        <View style={styles.headRow}>
          <View style={styles.price}>
            <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>Live</Text>
            <Text style={[TYPE.dataHero, { color: color.ink }]}>{spot === null ? "—" : assetPriceLine(market.asset, spot)}</Text>
          </View>
          <CountdownRing remainingSec={remaining} totalSec={market.lockAtSec - market.tradingStartSec} />
        </View>
        <WindowQuestion asset={market.asset} openingRaw={openingRaw} currentRaw={spot} />
        <WindowChart points={points} strikeRaw={openingRaw} />
        <SideButtons upCents={book.upCents} downCents={book.downCents} onPick={pick} disabled={remaining <= 0} />
      </ScrollView>
    </>
  );
}

function WindowTitle({ asset, cadence }: { asset: string; cadence: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.title}>
      <AssetDisc asset={asset} size={22} />
      <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{asset}</Text>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{cadence}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: SPACE.gutter, gap: 18, paddingBottom: 120 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  price: { gap: 2 },
  title: { flexDirection: "row", alignItems: "center", gap: 8 },
});
