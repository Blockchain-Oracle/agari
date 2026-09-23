import { isRestable } from "@agari/core/lifecycle";
import { isOk } from "@agari/core/schemas";
import type { MarketId, Side } from "@agari/core/types";
import { useMarket, useOpeningPrice } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useChartSeries } from "@/features/markets/hero/useChartSeries";
import { useOracleSpot } from "@/features/markets/hero/useOracleSpot";
import { useTopOfBook } from "@/features/markets/hero/useTopOfBook";
import { laneAssetLabel, laneTabLabel } from "@/features/markets/lanes/lane-view";
import { useWindowPhase } from "@/features/markets/ticket/useTicket";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { Button, Card, EmptyState, ErrorState, LoadingState, Screen, SectionHeader } from "~/components/kit";
import { SideButtons } from "~/components/window/SideButtons";
import { WindowLine } from "~/components/window/WindowLine";
import { NATIVE_MARKETS } from "~/features/markets/copy";
import { LiveVerdict } from "~/features/markets/verdict/LiveVerdict";
import { DepthBook } from "~/features/markets/window/DepthBook";
import { ListedWindow } from "~/features/markets/window/ListedWindow";
import { WindowHero, UpRamp } from "~/features/markets/window/WindowHero";
import { WindowLinks } from "~/features/markets/window/WindowLinks";
import { WindowRules } from "~/features/markets/window/WindowRules";

/**
 * One Window (web's /markets/<id> hero, rail and verdict, as a pushed screen): the price-to-beat sentence, the big live
 * price and the ring to the bell, the live line against the dashed strike, the Up/Down prices, the book, the rule and
 * its price source, and — once the bell has rung — this wallet's verdict and claim. A Window listed before its bell is
 * the asset page with a schedule seam instead.
 */
export default function WindowScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const reading = useMarket(id as MarketId);
  const market = reading && isOk(reading) ? reading.value : null;
  const nowMs = useChainNowMs();
  const phase = useWindowPhase(market, nowMs);
  const opening = useOpeningPrice(market?.marketId ?? null);
  const series = useChartSeries(market);
  const spot = useOracleSpot(market?.asset ?? null);
  const book = useTopOfBook(market);
  const refresh = () => queryClient.invalidateQueries();

  if (!market) {
    return (
      <Screen title={NATIVE_MARKETS.windowReading}>
        {reading === null ? (
          <LoadingState shape="chart" label={NATIVE_MARKETS.windowReading} />
        ) : !reading.ok ? (
          <ErrorState diagnosis={reading.error} retry={() => void refresh()} />
        ) : (
          <EmptyState why={NATIVE_MARKETS.windowGone} action={{ label: NATIVE_MARKETS.backToMarkets, onPress: () => router.navigate("/markets") }} />
        )}
      </Screen>
    );
  }

  const title = `${laneAssetLabel(market.asset, market.lane)} · ${laneTabLabel(market.lane, market.intervalSec)}`;
  const openingRaw = opening?.ok ? opening.value : market.openingPriceRaw;
  const latestRaw = series?.ok ? (series.value.latest?.valueRaw ?? null) : null;
  const currentRaw = latestRaw ?? spot;
  const pick = (side: Side) => router.push({ pathname: "/ticket", params: { m: market.marketId, dir: side } });
  const listed = phase !== null && isRestable(phase) && market.lane !== "token";
  const over = phase === "locked" || phase === "settledUnclaimed" || phase === "finalized" || phase === "voided";

  if (listed) {
    return (
      <Screen title={title} onRefresh={refresh}>
        <ListedWindow market={market} nowMs={nowMs} onPick={pick} />
        <WindowLinks market={market} />
        <SectionHeader index={NATIVE_MARKETS.sections.rule.index} title={NATIVE_MARKETS.sections.rule.title} />
        <WindowRules market={market} openingRaw={openingRaw} currentRaw={currentRaw} phase={phase} />
      </Screen>
    );
  }

  return (
    <Screen title={title} onRefresh={refresh}>
      <WindowHero market={market} openingRaw={openingRaw} currentRaw={currentRaw} phase={phase} nowMs={nowMs} />
      <Card style={styles.chart}>
        <WindowLine market={market} height={230} />
        <UpRamp upCents={book.upCents} />
      </Card>
      {over ? null : <SideButtons upCents={book.upCents} downCents={book.downCents} hydrating={book.hydrating} onPick={pick} />}
      <LiveVerdict marketId={market.marketId} />
      {over ? <Button label={NATIVE_MARKETS.backToMarkets} variant="secondary" onPress={() => router.navigate("/markets")} /> : null}
      <WindowLinks market={market} />
      <SectionHeader index={NATIVE_MARKETS.sections.book.index} title={NATIVE_MARKETS.sections.book.title} />
      <DepthBook market={market} />
      <SectionHeader index={NATIVE_MARKETS.sections.rule.index} title={NATIVE_MARKETS.sections.rule.title} />
      <WindowRules market={market} openingRaw={openingRaw} currentRaw={currentRaw} phase={phase} />
      <View style={styles.foot} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chart: { paddingHorizontal: 12, paddingVertical: 14 },
  foot: { height: 8 },
});
