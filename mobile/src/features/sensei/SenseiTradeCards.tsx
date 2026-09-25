import { formatCadence } from "@agari/core/market";
import type { EventMarket } from "@agari/core/types";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { assetPriceLine } from "@/features/markets/hero/units";
import { SENSEI_UI } from "@/features/sensei/copy";
import type { SenseiMarket } from "@/features/sensei/protocol";
import { HERO_HEAD, MARKETS } from "@/lib/copy";
import { haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { Countdown } from "~/features/markets/parts/Countdown";
import { FONT, useTheme } from "~/theme";
import { senseiTokens } from "~/theme/web/explore/sensei";
import { openWindow } from "~/features/markets/openWindow";

const priceOf = (asset: string, raw: bigint | null): string => (raw === null ? HERO_HEAD.noPrice : assetPriceLine(asset, raw));
const cents = (value: number | null): string => (value === null ? MARKETS.noBook : `${value}¢`);

/**
 * web's `SenseiTradeCards` (`.sensei-trade`): act on the read without leaving — each Window at the top of its real
 * book, and a side opens the one Ticket with it chosen, closing Sensei as web's drawer closes (never a second signing
 * path inside the chat). Hideable, as web's are.
 */
export function SenseiTradeCards({ markets, snapshotMarkets, nowMs }: { markets: readonly EventMarket[]; snapshotMarkets: readonly SenseiMarket[]; nowMs: number }) {
  const { name, color } = useTheme();
  const t = senseiTokens(name);
  const reduce = useReducedMotion();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const act = (market: EventMarket, dir: "up" | "down") => {
    haptic.tap();
    // web: the card is a link to /markets?m=&dir=, which opens the ticket there; Sensei's drawer closes under it.
    router.back();
    openWindow(market.marketId, dir);
  };

  return (
    <Animated.View entering={reduce ? undefined : FadeInDown.duration(320)} style={[styles.trade, { borderTopColor: t.rule }]}>
      <View style={styles.head}>
        <Text style={[styles.headTitle, { color: t.cardInk }]}>{SENSEI_UI.tradeHead}</Text>
        <View style={styles.headRight}>
          <Text style={[styles.sub, { color: color.inkMuted }]}>{SENSEI_UI.tradeSub}</Text>
          <Pressable onPress={() => setHidden(true)} hitSlop={12} accessibilityRole="button" accessibilityLabel={SENSEI_UI.tradeHide} style={styles.hide}>
            <Text style={[styles.hideText, { color: color.inkMuted }]}>✕</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView style={styles.list} contentContainerStyle={styles.listBody} nestedScrollEnabled>
        {markets.length === 0 ? <Text style={[styles.meta, { color: color.inkMuted }]}>{SENSEI_UI.tradeEmpty}</Text> : null}
        {markets.map((market, index) => {
          const book = snapshotMarkets[index];
          return (
            <View key={market.marketId} style={[styles.card, { borderColor: t.cardBorder, backgroundColor: t.cardFill }]}>
              <View style={styles.cardHead}>
                <View style={styles.asset}>
                  <AssetDisc asset={market.asset} size={16} />
                  <Text style={[styles.assetText, { color: t.cardInk }]}>
                    {market.asset} <Text style={styles.cadence}>{formatCadence(market.intervalSec)}</Text>
                  </Text>
                </View>
                <Text style={[styles.meta, { color: color.inkMuted }]}>
                  {priceOf(market.asset, market.openingPriceRaw)} ·{" "}
                  <Countdown expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} style={styles.metaClock} />
                </Text>
              </View>
              <View style={styles.sides}>
                {(["up", "down"] as const).map((dir) => {
                  const ink = dir === "up" ? color.profit : color.loss;
                  return (
                    <Pressable
                      key={dir}
                      onPress={() => act(market, dir)}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.side, { borderColor: dir === "up" ? t.upBorder : t.downBorder }, pressed && { transform: [{ scale: 0.98 }] }]}
                    >
                      <View style={styles.sideTop}>
                        <Text style={[styles.sideLabel, { color: ink }]}>{dir === "up" ? MARKETS.up : MARKETS.down}</Text>
                        <Text style={[styles.sideProb, { color: ink }]}>{cents((dir === "up" ? book?.upCents : book?.downCents) ?? null)}</Text>
                      </View>
                      <Text style={[styles.sidePay, { color: color.inkDisabled }]}>{SENSEI_UI.perDollar}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  trade: { paddingTop: 8, paddingBottom: 12, paddingHorizontal: 18, gap: 8, borderTopWidth: 1, maxHeight: "46%" },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingTop: 2, paddingHorizontal: 2 },
  headTitle: { fontFamily: FONT.heading, fontSize: 13 },
  headRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  sub: { fontFamily: FONT.dataRegular, fontSize: 9, letterSpacing: 1.26, textTransform: "uppercase" },
  hide: { paddingVertical: 2, paddingHorizontal: 4 },
  hideText: { fontSize: 13, lineHeight: 13 },
  list: { flexGrow: 0 },
  listBody: { gap: 8, paddingBottom: 2 },
  card: { borderWidth: 1, borderRadius: 13, paddingVertical: 11, paddingHorizontal: 12 },
  cardHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 9 },
  asset: { flexDirection: "row", alignItems: "center", gap: 6 },
  assetText: { fontFamily: FONT.heading, fontSize: 14 },
  cadence: { fontFamily: FONT.headingHeavy, fontVariant: ["tabular-nums"] },
  meta: { fontFamily: FONT.dataRegular, fontSize: 9.5, letterSpacing: 0.475, textTransform: "uppercase", fontVariant: ["tabular-nums"] },
  metaClock: { fontFamily: FONT.dataRegular, fontSize: 9.5, lineHeight: 14 },
  sides: { flexDirection: "row", gap: 7 },
  side: { flex: 1, gap: 3, borderWidth: 1, borderRadius: 11, paddingTop: 9, paddingBottom: 8, paddingHorizontal: 11 },
  sideTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  sideLabel: { fontFamily: FONT.dataStrong, fontSize: 12.5, letterSpacing: 1.25 },
  sideProb: { fontFamily: FONT.dataStrong, fontSize: 16, letterSpacing: -0.16, fontVariant: ["tabular-nums"] },
  sidePay: { fontFamily: FONT.dataRegular, fontSize: 9, letterSpacing: 0.9, textTransform: "uppercase" },
});
