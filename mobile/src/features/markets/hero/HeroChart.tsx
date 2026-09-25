import { countdown } from "@agari/core/lifecycle";
import type { EventMarket, Lane, MarketId, Side } from "@agari/core/types";
import { formatClock } from "@agari/core/units";
import { useOpeningPrice } from "@agari/markets/react";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useChartSeries } from "@/features/markets/hero/useChartSeries";
import { useTopOfBook } from "@/features/markets/hero/useTopOfBook";
import { etWeekday, laneAssetLabel, type LaneTabKey } from "@/features/markets/lanes/lane-view";
import { windowSourceLabel } from "@/features/markets/price-source/source-label";
import { HERO_HEAD, LANE_STATE, MARKETS } from "@/lib/copy";
import { haptic } from "~/components/kit";
import { ReadingBoundary } from "~/components/portfolio/web/states";
import { FONT } from "~/theme";
import { SourceLine } from "../parts/SourceLine";
import { AssetRow, HeadShell, HeroCadenceTabs, HeroQuestion, Settles } from "./HeroHead";
import { LiveFoot } from "./HeroFoot";
import { mkType, useMk } from "./mk";
import { HERO_CHART_HEIGHT, PriceChart } from "./PriceChart";

/** `.hero-chart`: the one panel the page is about — 4 px radius, its own ground and hairline, clipped. */
export function HeroPanel({ children }: { children: ReactNode }) {
  const mk = useMk();
  return <View style={[styles.panel, { backgroundColor: mk.panelBg, borderColor: mk.panelBorder }]}>{children}</View>;
}

/** `.hero-chart-canvas`: the chart's 230 px, holding its loading and error states at that height. */
export function ChartCanvas({ children }: { children: ReactNode }) {
  return <View style={styles.canvas}>{children}</View>;
}

interface HeroChartProps {
  market: EventMarket;
  nowMs: number;
  lanes: readonly Lane[];
  activeLaneKey: LaneTabKey | null;
  pinnedMissingKey: LaneTabKey | null;
  onPin: (key: LaneTabKey) => void;
  onSelect: (marketId: MarketId, side: Side) => void;
  onOpenRoom: () => void;
}

/**
 * web's HeroChart on a phone: the question, the chart under it and the call as one object — the head (asset, lane
 * tabs, the headline against the opening print, the distance, the source; the clock to the bell), the live chart, the
 * foot (the Room, the alert, the UP ramp) and `.hero-yesno`, the two buttons that open the ticket on a side.
 */
export function HeroChart({ market, nowMs, lanes, activeLaneKey, pinnedMissingKey, onPin, onSelect, onOpenRoom }: HeroChartProps) {
  const mk = useMk();
  const opening = useOpeningPrice(market.marketId);
  const series = useChartSeries(market);
  const book = useTopOfBook(market);
  const openingRaw = opening?.ok ? opening.value : market.openingPriceRaw;
  const latestRaw = series?.ok ? (series.value.latest?.valueRaw ?? null) : null;
  const asset = laneAssetLabel(market.asset, market.lane);
  const ask = market.lane === "gap" ? LANE_STATE.gap.opensAbove(asset, etWeekday(market.expirySec)) : undefined;
  const clock = nowMs > 0 ? countdown(nowMs, market.expirySec, market.intervalSec) : null;

  return (
    <HeroPanel>
      <HeadShell clock={<Settles label={HERO_HEAD.settlesIn} value={clock ? formatClock(clock.remainingSec) : "—"} urgent={clock?.urgent ?? false} />}>
        <AssetRow asset={market.asset} label={asset}>
          <HeroCadenceTabs lanes={lanes} activeKey={activeLaneKey} pinnedMissingKey={pinnedMissingKey} onPin={onPin} />
        </AssetRow>
        <HeroQuestion asset={asset} ask={ask} openingRaw={openingRaw} currentRaw={latestRaw} />
        <SourceLine label={windowSourceLabel(market)} textStyle={[mkType.pairMeta, styles.source, { color: mk.gray400 }]} />
      </HeadShell>
      <ChartCanvas>
        <ReadingBoundary reading={series} shape="chart">
          {(chart) => <PriceChart points={chart.points} openingRaw={openingRaw} />}
        </ReadingBoundary>
      </ChartCanvas>
      <LiveFoot book={book} asset={market.asset} currentRaw={latestRaw} onOpenRoom={onOpenRoom} />
      <View style={styles.yesno}>
        <SideButton side="up" cents={book.upCents} onPress={() => onSelect(market.marketId, "up")} />
        <SideButton side="down" cents={book.downCents} onPress={() => onSelect(market.marketId, "down")} />
      </View>
    </HeroPanel>
  );
}

/** `.hyn`: mono caps, flat fill, 10 px radius — the small card's `.mc-side`, so the hero reads balanced. */
function SideButton({ side, cents, onPress }: { side: Side; cents: number | null; onPress: () => void }) {
  const mk = useMk();
  const up = side === "up";
  const ink = up ? mk.profit : mk.loss;
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={up ? HERO_HEAD.betUp : HERO_HEAD.betDown}
      style={({ pressed }) => [styles.hyn, { backgroundColor: up ? mk.upBg : mk.downBg, borderColor: up ? mk.upBorder : mk.downBorder }, pressed && styles.pressed]}
    >
      <Text style={[styles.hynLabel, { color: ink }]}>{up ? MARKETS.up : MARKETS.down}</Text>
      <Text style={[styles.hynPrice, { color: ink }]}>{cents === null ? HERO_HEAD.noPrice : `${cents}¢`}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 4, overflow: "hidden" },
  canvas: { minHeight: HERO_CHART_HEIGHT, justifyContent: "center" },
  source: { marginTop: 4 },
  yesno: { flexDirection: "row", gap: 9, marginTop: 12 },
  hyn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  hynLabel: { fontFamily: FONT.dataStrong, fontSize: 12, lineHeight: 19.2, letterSpacing: 0.96, textTransform: "uppercase" },
  hynPrice: { fontFamily: FONT.dataStrong, fontSize: 12, lineHeight: 19.2, letterSpacing: -0.24, opacity: 0.82 },
  pressed: { transform: [{ scale: 0.985 }] },
});
