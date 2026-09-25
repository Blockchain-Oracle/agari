import { countdown } from "@agari/core/lifecycle";
import { neededMove } from "@agari/core/market";
import type { EventMarket, MarketId, Side } from "@agari/core/types";
import { formatClock } from "@agari/core/units";
import { useOpeningPrice } from "@agari/markets/react";
import { memo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useOracleSpot } from "@/features/markets/hero/useOracleSpot";
import { assetPriceLine, assetSpotLine } from "@/features/markets/hero/units";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { formatCadence, REELS } from "@/lib/copy";
import { haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { WindowLine } from "~/components/window/WindowLine";
import { FONT } from "~/theme";
import { ReelFrame } from "./ReelFrame";
import { useReelTokens } from "./tokens";
import { openWindow } from "../openWindow";

/** Local wall-clock hour and minute — the reference's `clockHM`, in the viewer's own zone. */
function closesAt(expirySec: number): string {
  return new Date(expirySec * 1_000).toLocaleTimeString(undefined, { hour12: false, hour: "2-digit", minute: "2-digit" });
}

interface Props {
  market: EventMarket;
  /** False for a card more than one swipe away: it keeps its frame and reads nothing live. */
  near: boolean;
  /** The Window no longer takes entries — the call row says so instead of offering a side. */
  closing: boolean;
}

/**
 * web's `ReelCard`: one Window as a framed portrait card — the head, the question against the opening print, the
 * chart as the hero, and the call. Every live read is gated on `near`, so a reel of twenty Windows holds three
 * subscriptions; the clock is read in the head, so the memoised card does not re-render every second.
 */
export const ReelCard = memo(function ReelCard({ market, near, closing }: Props) {
  const opening = useOpeningPrice(near ? market.marketId : null);
  const spotRaw = useOracleSpot(near ? market : null);
  const openingRaw = opening?.ok ? opening.value : market.openingPriceRaw;
  return (
    <ReelFrame>
      <ReelHead market={market} />
      <ReelQuestion asset={market.asset} openingRaw={openingRaw} currentRaw={spotRaw} />
      <ReelChart market={market} near={near} />
      <ReelCall marketId={market.marketId} closing={closing} />
    </ReelFrame>
  );
});

/** web's `ReelHead`: the asset's mark, "QQQ · settles on the price", the round and its bell, and the clock. */
function ReelHead({ market }: { market: EventMarket }) {
  const t = useReelTokens();
  const nowMs = useChainNowMs();
  const state = nowMs > 0 ? countdown(nowMs, market.expirySec, market.intervalSec) : null;
  return (
    <View style={styles.head}>
      <View style={styles.ident}>
        <View style={styles.badge}>
          <AssetDisc asset={market.asset} size={30} />
        </View>
        <View style={styles.shrink}>
          <Text style={[styles.meta, { color: t.ink70 }]} numberOfLines={1}>
            {REELS.settlesOn(market.asset).toUpperCase()}
          </Text>
          <Text style={[styles.submeta, { color: t.ink35 }]} numberOfLines={1}>
            {REELS.round(formatCadence(market.intervalSec), closesAt(market.expirySec)).toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.clock}>
        <Text style={[styles.clockLabel, { color: t.ink40 }]}>{REELS.closesIn.toUpperCase()}</Text>
        <Text style={[styles.clockValue, { color: state?.urgent ? t.vermilion : t.ink }]}>{state ? formatClock(state.remainingSec) : REELS.noClock}</Text>
      </View>
    </View>
  );
}

/** web's `ReelQuestion`: "Will QQQ be above $747.22?", the live price and "− $2.93 vs line" — the rule from core `neededMove`. */
function ReelQuestion({ asset, openingRaw, currentRaw }: { asset: string; openingRaw: bigint | null; currentRaw: bigint | null }) {
  const t = useReelTokens();
  const move = openingRaw !== null && currentRaw !== null ? neededMove(currentRaw, openingRaw) : null;
  const above = move ? move.upNeedsRaw === 0n : false;
  return (
    <View style={styles.ask}>
      <Text style={[styles.question, { color: t.ink }]} accessibilityRole="header">
        {REELS.holdsAbove(asset)}{" "}
        {openingRaw === null ? <Text style={{ color: t.ink40 }}>{REELS.noLine}</Text> : <Text style={{ color: t.vermilion }}>{assetPriceLine(asset, openingRaw)}</Text>}
        <Text style={{ color: t.ink85 }}>?</Text>
      </Text>
      <View style={styles.spot}>
        <Text style={[styles.spotText, { color: t.ink }]}>{currentRaw === null ? REELS.noLine : assetSpotLine(asset, currentRaw)}</Text>
        {move && openingRaw !== null && currentRaw !== null ? (
          <Text style={[styles.spotText, { color: above ? t.vermilion : t.ink45 }]}>
            {above ? "+" : "−"}
            {assetPriceLine(asset, above ? currentRaw - openingRaw : move.upNeedsRaw, openingRaw)} {REELS.versusLine}
          </Text>
        ) : null}
        <Text style={[styles.spotLabel, { color: t.ink35 }]}>{REELS.livePrice.toUpperCase()}</Text>
      </View>
    </View>
  );
}

/** web's `ReelChart` in `.reel-chart`: the card's hero, mounted only near the screen; further away it says to swipe to it. */
function ReelChart({ market, near }: { market: EventMarket; near: boolean }) {
  const t = useReelTokens();
  const [height, setHeight] = useState(0);
  return (
    <View style={styles.chart} onLayout={(e) => setHeight(Math.floor(e.nativeEvent.layout.height))}>
      {!near ? (
        <View style={styles.chartHolding}>
          <Text style={[styles.chartHoldingText, { color: t.ink30 }]}>{REELS.swipeToRead.toUpperCase()}</Text>
        </View>
      ) : height > 0 ? (
        <WindowLine market={market} height={height} />
      ) : null}
    </View>
  );
}

/** web's `ReelCall`: UP and DOWN straight into the ticket with that side chosen, or the closing note inside the buffer. */
function ReelCall({ marketId, closing }: { marketId: MarketId; closing: boolean }) {
  const t = useReelTokens();
  if (closing) {
    return (
      <View style={styles.call}>
        <Text style={[styles.note, { borderColor: t.ink08, backgroundColor: t.ink02, color: t.ink45 }]}>{REELS.closing.toUpperCase()}</Text>
      </View>
    );
  }
  const pick = (dir: Side) => {
    haptic.tap();
    openWindow(marketId, dir);
  };
  return (
    <View style={[styles.call, styles.pair]}>
      <Pressable
        onPress={() => pick("up")}
        accessibilityRole="link"
        accessibilityLabel={`${REELS.up}: open the ticket`}
        style={({ pressed }) => [styles.side, { borderColor: t.v60, backgroundColor: pressed ? t.v25 : t.v10 }]}
      >
        <Text style={[styles.sideText, { color: t.vermilion }]}>{REELS.up}</Text>
      </Pressable>
      <Pressable
        onPress={() => pick("down")}
        accessibilityRole="link"
        accessibilityLabel={`${REELS.down}: open the ticket`}
        style={({ pressed }) => [styles.side, { borderColor: pressed ? t.ink30 : t.ink15, backgroundColor: t.ink02 }]}
      >
        {({ pressed }) => <Text style={[styles.sideText, { color: pressed ? t.ink : t.ink80 }]}>{REELS.down}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { zIndex: 10, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingTop: 20, paddingHorizontal: 20 },
  ident: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  badge: { width: 32, height: 32, borderRadius: 9999, borderWidth: 1, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  shrink: { flexShrink: 1 },
  meta: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 12, letterSpacing: 1.6 },
  submeta: { marginTop: 2, fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 10.8, letterSpacing: 1.26 },
  clock: { flexShrink: 0, alignItems: "flex-end" },
  clockLabel: { fontFamily: FONT.dataRegular, fontSize: 8, lineHeight: 12.8, letterSpacing: 1.6 },
  clockValue: { fontFamily: FONT.headingHeavy, fontSize: 24, lineHeight: 24, fontVariant: ["tabular-nums"] },
  ask: { zIndex: 10, paddingTop: 16, paddingHorizontal: 20 },
  question: { fontFamily: FONT.headingHeavy, fontSize: 26, lineHeight: 27.56, letterSpacing: -0.52 },
  spot: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 10 },
  spotText: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2, fontVariant: ["tabular-nums"] },
  spotLabel: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.4 },
  chart: { zIndex: 10, flex: 1, minHeight: 0, marginTop: 8, paddingHorizontal: 6 },
  chartHolding: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  chartHoldingText: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.6, textAlign: "center" },
  call: { zIndex: 10, paddingTop: 8, paddingHorizontal: 20, paddingBottom: 24 },
  pair: { flexDirection: "row", gap: 12 },
  side: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 12, alignItems: "center" },
  sideText: { fontFamily: FONT.heading, fontSize: 16, lineHeight: 25.6 },
  note: { borderRadius: 16, borderWidth: 1, overflow: "hidden", paddingVertical: 16, paddingHorizontal: 20, textAlign: "center", fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 17, letterSpacing: 1.8 },
});
