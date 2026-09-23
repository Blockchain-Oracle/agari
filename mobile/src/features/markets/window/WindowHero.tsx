import type { MarketPhase } from "@agari/core/lifecycle";
import { isTickerSymbol, TICKERS } from "@agari/core/market";
import type { EventMarket } from "@agari/core/types";
import { StyleSheet, Text, View } from "react-native";
import { assetSpotLine } from "@/features/markets/hero/units";
import { etWeekday, laneAssetLabel, laneCadenceLabel } from "@/features/markets/lanes/lane-view";
import { windowSourceLabel } from "@/features/markets/price-source/source-label";
import { HERO, HERO_HEAD, LANE_STATE } from "@/lib/copy";
import { CLOSED } from "@/lib/copy-closed";
import { Pill } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { CountdownRing } from "~/components/ui/CountdownRing";
import { WindowQuestion } from "~/components/window/WindowQuestion";
import { TYPE, useTheme } from "~/theme";
import { NATIVE_MARKETS } from "../copy";
import { SessionChip } from "../parts/SessionChip";
import { SourceLine } from "../parts/SourceLine";

interface Props {
  market: EventMarket;
  openingRaw: bigint | null;
  /** The newest print on the settlement basis (the chart's last point, else the spot). */
  currentRaw: bigint | null;
  phase: MarketPhase | null;
  nowMs: number;
}

/**
 * web's HeroChartHead + CountdownBlock: the asset and its lane, the session, the price-to-beat sentence and how far
 * the live price sits from it, the source, then the big live price beside the ring that empties to the bell (vermilion
 * in the last 30 s).
 */
export function WindowHero({ market, openingRaw, currentRaw, phase, nowMs }: Props) {
  const { color } = useTheme();
  const asset = laneAssetLabel(market.asset, market.lane);
  const kind = market.lane === "token" && isTickerSymbol(market.asset) ? CLOSED.kind[TICKERS[market.asset].kind] : null;
  const ask = market.lane === "gap" ? LANE_STATE.gap.opensAbove(asset, etWeekday(market.expirySec)) : undefined;
  const nowSec = nowMs > 0 ? nowMs / 1000 : market.tradingStartSec;
  const remaining = Math.max(0, market.expirySec - nowSec);
  return (
    <View style={styles.wrap}>
      <View style={styles.assetRow}>
        <AssetDisc asset={market.asset} size={34} />
        <Text style={[TYPE.title, { color: color.ink }]}>{asset}</Text>
        <Pill label={laneCadenceLabel(market.lane, market.intervalSec)} />
        {kind ? <Pill label={kind} tone="accent" /> : null}
      </View>
      <View style={styles.metaRow}>
        <SessionChip asset={asset} />
        {phase && phase !== "trading" ? <Text style={[TYPE.labelMicro, { color: color.inkSecondary }]}>{HERO.phase[phase]}</Text> : null}
      </View>
      <WindowQuestion asset={asset} ask={ask} openingRaw={openingRaw} currentRaw={currentRaw} />
      <SourceLine label={windowSourceLabel(market)} />
      <View style={[styles.priceRow, { borderTopColor: color.hairline }]}>
        <View style={styles.price}>
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{NATIVE_MARKETS.livePrice}</Text>
          <Text style={[TYPE.dataHero, { color: color.ink }]} adjustsFontSizeToFit numberOfLines={1}>
            {currentRaw === null ? HERO_HEAD.noPrice : assetSpotLine(asset, currentRaw)}
          </Text>
        </View>
        <View style={styles.clock}>
          <CountdownRing remainingSec={remaining} totalSec={market.expirySec - market.tradingStartSec} size={84} />
          <Text style={[TYPE.labelMicro, { color: remaining <= 30 && remaining > 0 ? color.accent : color.inkMuted }]}>{HERO_HEAD.settlesIn}</Text>
        </View>
      </View>
    </View>
  );
}

/** web's HeroChartFoot ramp: the bar's fill is the UP price, so 64¢ fills 64 %; an empty book draws nothing. */
export function UpRamp({ upCents }: { upCents: number | null }) {
  const { color } = useTheme();
  return (
    <View style={styles.ramp} accessibilityLabel={`UP costs ${upCents === null ? "nothing quoted" : `${upCents} cents`}`}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{HERO_HEAD.rampUp}</Text>
      <View style={[styles.bar, { backgroundColor: color.surface2 }]}>
        {upCents !== null ? <View style={[styles.fill, { width: `${upCents}%`, backgroundColor: color.profit }]} /> : null}
      </View>
      <Text style={[TYPE.data, { color: color.ink }]}>{upCents === null ? HERO_HEAD.noPrice : `${upCents}¢`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  assetRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  price: { flex: 1, gap: 4 },
  clock: { alignItems: "center", gap: 4 },
  ramp: { flexDirection: "row", alignItems: "center", gap: 10 },
  bar: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
});
