import { phase as phaseOf, type MarketPhase } from "@agari/core/lifecycle";
import { isTickerSymbol, TICKERS } from "@agari/core/market";
import type { EventMarket, Side } from "@agari/core/types";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { useChartSeries } from "@/features/markets/hero/useChartSeries";
import { useTopOfBook } from "@/features/markets/hero/useTopOfBook";
import { assetPriceLine } from "@/features/markets/hero/units";
import { etWeekday, laneAssetLabel, laneCadenceLabel } from "@/features/markets/lanes/lane-view";
import { HERO_HEAD, LANE_CARD, LANE_STATE } from "@/lib/copy";
import { CLOSED } from "@/lib/copy-closed";
import { useWhen } from "@/lib/when";
import { Card, haptic, Pill } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { SideButtons } from "~/components/window/SideButtons";
import { TYPE, useTheme } from "~/theme";
import { LiveLine } from "../chart/LiveLine";
import { Countdown } from "../parts/Countdown";
import { UpRamp } from "../window/WindowHero";
import { ListedCard } from "./ListedCard";

/** A Gap Window that far from its lock names the lock instead of counting fifty hours down. */
const GAP_COUNTDOWN_FROM_SEC = 3_600;

/** The strip when the Window no longer takes calls: the closing line, or the Gap's own locked and settled words. */
function closedStrip(market: EventMarket, current: MarketPhase, when: ReturnType<typeof useWhen>): string {
  if (market.lane !== "gap") return LANE_CARD.closing;
  if (current === "pendingOpeningPrint") return LANE_STATE.gap.pendingOpen;
  if (current === "voided") return LANE_STATE.gap.settled.void;
  if (current === "settledUnclaimed" || current === "finalized") return market.winningOutcome === 1 ? LANE_STATE.gap.settled.down : LANE_STATE.gap.settled.up;
  return LANE_STATE.gap.locked(when(market.expirySec, { seconds: true }));
}

/**
 * One live Window in the rail — web's MarketCardView (Masayume's `Market624Card`): the asset and its lane, the clock,
 * the question against the opening print, the live price and its distance from the line, the spark with its strike,
 * the UP ramp, and the two calls at the book's best asks. The card opens the Window; a side opens the ticket on it.
 */
// 21st: isaiahbjork/prediction-market-card (the spring entrance and the live ramp)
export function MarketCard({ market, nowMs, index = 0 }: { market: EventMarket; nowMs: number; index?: number }) {
  const { color } = useTheme();
  const when = useWhen();
  const reduce = useReducedMotion();
  const series = useChartSeries(market);
  const book = useTopOfBook(market);
  const current = nowMs > 0 ? phaseOf(market, nowMs) : null;
  if (current === "upcoming" && market.lane !== "token") return <ListedCard market={market} />;

  const asset = laneAssetLabel(market.asset, market.lane);
  const kind = market.lane === "token" && isTickerSymbol(market.asset) ? CLOSED.kind[TICKERS[market.asset].kind] : null;
  const ask = market.lane === "gap" ? LANE_STATE.gap.opensAbove(asset, etWeekday(market.expirySec)) : HERO_HEAD.holdsAbove(asset);
  const openingRaw = market.openingPriceRaw;
  const points = series?.ok ? series.value.points : [];
  const latestRaw = series?.ok ? (series.value.latest?.valueRaw ?? null) : null;
  const closing = current !== null && current !== "trading";
  const open = () => router.push({ pathname: "/markets/[id]", params: { id: market.marketId } });
  const pick = (side: Side) => router.push({ pathname: "/ticket", params: { m: market.marketId, dir: side } });
  const above = openingRaw !== null && latestRaw !== null ? latestRaw >= openingRaw : null;

  return (
    <Animated.View entering={reduce ? undefined : FadeInDown.springify().damping(18).delay(Math.min(index, 6) * 50)}>
      <Card>
        <Pressable
          onPress={() => {
            haptic.tap();
            open();
          }}
          accessibilityRole="button"
          accessibilityLabel={LANE_CARD.openTicket(asset)}
          style={({ pressed }) => [styles.open, pressed && styles.pressed]}
        >
          <View style={styles.head}>
            <View style={styles.asset}>
              <AssetDisc asset={market.asset} size={28} />
              <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{asset}</Text>
              <Pill label={laneCadenceLabel(market.lane, market.intervalSec)} />
              {kind ? <Pill label={kind} tone="accent" /> : null}
            </View>
            <GapAwareClock market={market} nowMs={nowMs} current={current} when={when} />
          </View>
          <Text style={[TYPE.title, { color: color.ink }]}>
            {ask} {openingRaw === null ? <Text style={{ color: color.inkMuted }}>···</Text> : <Text style={{ color: color.accent }}>{assetPriceLine(asset, openingRaw)}?</Text>}
          </Text>
          <View style={styles.priceRow}>
            <Text style={[TYPE.dataLg, { color: color.ink }]}>{latestRaw === null ? HERO_HEAD.noPrice : assetPriceLine(asset, latestRaw)}</Text>
            {above !== null && openingRaw !== null && latestRaw !== null ? (
              <Text style={[TYPE.data, { color: above ? color.profit : color.loss }]}>
                {above ? "+" : "−"}
                {assetPriceLine(asset, above ? latestRaw - openingRaw : openingRaw - latestRaw, openingRaw)}
              </Text>
            ) : null}
          </View>
          {points.length >= 2 ? <LiveLine points={points} strikeRaw={openingRaw} asset={asset} height={56} bare /> : <View style={styles.sparkHold} />}
        </Pressable>
        {closing && current ? (
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{closedStrip(market, current, when)}</Text>
        ) : (
          <>
            <View style={styles.strip}>
              <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>
                {book.upCents !== null ? LANE_CARD.oddsLive : book.hydrating || book.downCents !== null ? LANE_CARD.oddsLoading : LANE_CARD.noQuotes}
              </Text>
              <View style={styles.ramp}>
                <UpRamp upCents={book.upCents} />
              </View>
            </View>
            <SideButtons upCents={book.upCents} downCents={book.downCents} hydrating={book.hydrating} onPick={pick} height={48} />
          </>
        )}
      </Card>
    </Animated.View>
  );
}

/** web's GapClock: a Gap names its lock (then its settle) until the last hour, then counts it down; others count to the bell. */
function GapAwareClock({ market, nowMs, current, when }: { market: EventMarket; nowMs: number; current: MarketPhase | null; when: ReturnType<typeof useWhen> }) {
  const { color } = useTheme();
  if (market.lane !== "gap") return <Countdown expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} />;
  if (current === "settledUnclaimed" || current === "finalized" || current === "voided") return <Text style={[TYPE.caption, { color: color.inkMuted }]}>{LANE_STATE.gap.settledClock}</Text>;
  const nowSec = Math.floor(nowMs / 1000);
  const target = nowSec < market.lockAtSec ? market.lockAtSec : market.expirySec;
  if (nowMs === 0 || target - nowSec > GAP_COUNTDOWN_FROM_SEC) {
    return (
      <Text style={[TYPE.caption, { color: color.inkSecondary }]} numberOfLines={1}>
        {target === market.lockAtSec ? LANE_STATE.gap.locks(when(market.lockAtSec)) : LANE_STATE.gap.settles(when(market.expirySec))}
      </Text>
    );
  }
  return <Countdown expirySec={target} intervalSec={GAP_COUNTDOWN_FROM_SEC} nowMs={nowMs} />;
}

const styles = StyleSheet.create({
  open: { gap: 12 },
  pressed: { opacity: 0.86 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  asset: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, flexWrap: "wrap" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  sparkHold: { height: 56 },
  strip: { gap: 6 },
  ramp: { flex: 1 },
});
