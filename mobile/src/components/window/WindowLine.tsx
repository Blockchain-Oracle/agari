import type { EventMarket } from "@agari/core/types";
import { useOpeningPrice } from "@agari/markets/react";
import { StyleSheet, Text, View } from "react-native";
import { useChartSeries } from "@/features/markets/hero/useChartSeries";
import { laneAssetLabel } from "@/features/markets/lanes/lane-view";
import { REELS } from "@/lib/copy";
import { ErrorState, Skeleton } from "~/components/kit";
import { LiveLine } from "~/features/markets/chart/LiveLine";
import { TYPE, useTheme } from "~/theme";

/** A minute before the open, as web's useChartSeries reads it. */
const HISTORY_LEAD_SEC = 60;

/**
 * One Window's live line, read and drawn: web's ReelChart / TicketMiniChart / the hero canvas. The series is web's
 * `useChartSeries` (the settlement basis, history from a minute before the open, then live ticks); the strike is the
 * head-fresh opening print. The x-axis runs to the Window's bell, so the line visibly walks toward it.
 */
export function WindowLine({ market, height = 220, bare = false }: { market: EventMarket; height?: number; bare?: boolean }) {
  const { color } = useTheme();
  const series = useChartSeries(market);
  const opening = useOpeningPrice(market.marketId);
  const openingRaw = opening?.ok ? opening.value : market.openingPriceRaw;
  const asset = laneAssetLabel(market.asset, market.lane);

  if (series === null) return <Skeleton height={height} radius={12} />;
  if (!series.ok) return <ErrorState diagnosis={series.error} />;
  if (series.value.points.length < 2) {
    return (
      <View style={[styles.holding, { height, borderColor: color.hairline }]}>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{REELS.chartHolding}</Text>
      </View>
    );
  }
  return (
    <LiveLine
      points={series.value.points}
      strikeRaw={openingRaw}
      asset={asset}
      height={height}
      bare={bare}
      domain={{ fromSec: market.tradingStartSec - HISTORY_LEAD_SEC, toSec: market.expirySec }}
    />
  );
}

const styles = StyleSheet.create({
  holding: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
});
