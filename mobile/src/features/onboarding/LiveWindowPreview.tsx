import { isTickerSymbol } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import type { EventMarket } from "@agari/core/types";
import { useAssetPrice, useLanes } from "@agari/markets/react";
import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";
import { basisRaw, feedRawToOracleRaw } from "@/features/markets/hero/units";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { Pill, Skeleton } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { WindowQuestion } from "~/components/window/WindowQuestion";
import { marketsEnv } from "~/lib/env";
import { RADIUS, TYPE, useTheme } from "~/theme";

/** The soonest-closing Window that is trading right now, or null between Windows / before the answer. */
function useLiveWindow(): { market: EventMarket | null; loading: boolean } {
  const lanes = useLanes(marketsEnv.venueId ?? null);
  const nowMs = useChainNowMs();
  if (!lanes) return { market: null, loading: true };
  if (!isOk(lanes) || !nowMs) return { market: null, loading: false };
  const open = lanes.value.lanes
    .flatMap((lane) => lane.markets)
    .filter((m) => m.status === "Trading" && m.lockAtSec * 1000 > nowMs && m.openingPriceRaw !== null)
    .sort((a, b) => a.lockAtSec - b.lockAtSec);
  return { market: open[0] ?? null, loading: false };
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

/**
 * The first screen's picture is a real Window from the venue: its asset, the price it settles against and where the
 * live price sits now. Nothing here is a sample; with no Window trading it says so.
 */
export function LiveWindowPreview() {
  const { color } = useTheme();
  const { market, loading } = useLiveWindow();
  const nowMs = useChainNowMs();
  const reading = useAssetPrice(market && isTickerSymbol(market.asset) ? market.asset : null);
  const point = reading && isOk(reading) ? reading.value : null;
  const currentRaw = point ? feedRawToOracleRaw(basisRaw(point), point.decimals) : null;
  const leftSec = market && nowMs ? Math.max(0, Math.floor(market.lockAtSec - nowMs / 1000)) : null;

  return (
    <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <View style={styles.head}>
        <Text style={[TYPE.labelMicro, { color: color.accent }]}>Live now</Text>
        {market && leftSec !== null ? <Pill label={`Locks in ${clock(leftSec)}`} tone="accent" dot /> : null}
      </View>
      {loading ? (
        <View style={styles.gap}>
          <Skeleton width="60%" height={22} />
          <Skeleton width="85%" height={16} />
        </View>
      ) : market ? (
        <>
          <View style={styles.asset}>
            <AssetDisc asset={market.asset} size={36} />
            <Text style={[TYPE.title, { color: color.ink }]}>{market.asset}</Text>
            <Text style={[TYPE.data, { color: color.inkMuted }]}>{market.intervalSec / 60}m Window</Text>
          </View>
          <WindowQuestion asset={market.asset} openingRaw={market.openingPriceRaw} currentRaw={currentRaw} />
          <View style={styles.sides}>
            <View style={[styles.side, { backgroundColor: color.profitWash }]}>
              <SymbolView name={{ ios: "arrow.up", android: "arrow_upward" }} size={15} tintColor={color.profit} />
              <Text style={[TYPE.bodyStrong, { color: color.profit }]}>Up</Text>
            </View>
            <View style={[styles.side, { backgroundColor: color.lossWash }]}>
              <SymbolView name={{ ios: "arrow.down", android: "arrow_downward" }} size={15} tintColor={color.loss} />
              <Text style={[TYPE.bodyStrong, { color: color.loss }]}>Down</Text>
            </View>
          </View>
        </>
      ) : (
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>No Window is trading this minute. The markets tab shows what opens next and lets you call it in advance.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  gap: { gap: 10 },
  asset: { flexDirection: "row", alignItems: "center", gap: 10 },
  sides: { flexDirection: "row", gap: 10 },
  side: { flex: 1, height: 44, borderRadius: RADIUS.md, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" },
});
