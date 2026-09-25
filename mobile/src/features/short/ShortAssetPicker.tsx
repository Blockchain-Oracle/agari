import type { TickerSymbol } from "@agari/core/market";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { DeskMarks } from "@/features/desk/useDeskMarks";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { SHORT } from "@/features/short/copy";
import { opensAt, type ShortStock } from "@/features/short/useShortWindows";
import { haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { Sparkline } from "~/features/baskets/DeskKit";
import { FONT, useTheme } from "~/theme";
import { basketsShortTokens } from "~/theme/web/products/baskets-short";
import { lineOf, nameOfAsset, PriceLine } from "./assets";

const P = SHORT.picker;
const CHIP_W = 132;
const CHIP_GAP = 8;

interface Group {
  key: string;
  label: string | null;
  stocks: ShortStock[];
}

/** web's `groupsOf`: tradable names first while others wait for the bell, the waiting group named by the session. */
function groupsOf(stocks: ShortStock[], sessionLabel: string | null): Group[] {
  const live = stocks.filter((s) => s.liveCount > 0);
  const later = stocks.filter((s) => s.liveCount === 0);
  if (live.length === 0 || later.length === 0) return [{ key: "all", label: null, stocks }];
  const allStocks = later.every((s) => s.kind === "stock");
  return [
    { key: "live", label: P.groupLive, stocks: live },
    { key: "later", label: allStocks && sessionLabel ? P.groupLater(sessionLabel) : P.groupLaterBare, stocks: later },
  ];
}

/**
 * web's `ShortAssetPicker` below 640 px (`.sh-chips`, short-picker.css): each group's label, then a snap row of
 * 132 px name cards — mark, name, cashtag, the live dot and the price — fading out at the right edge. One radio group.
 */
export function ShortAssetPicker({ stocks, value, onChange }: { stocks: ShortStock[]; value: string; onChange: (asset: TickerSymbol) => void }) {
  const { color, name } = useTheme();
  const t = basketsShortTokens(name);
  const session = useMarketSession();
  const groups = groupsOf(stocks, session && !session.open ? session.label : null);
  return (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={P.stock}>
      {groups.map((g) => (
        <View key={g.key} style={styles.group}>
          {g.label ? <Text style={[styles.groupLabel, { color: color.inkMuted }]}>{g.label}</Text> : null}
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CHIP_W + CHIP_GAP}
              decelerationRate="fast"
              contentContainerStyle={styles.row}
            >
              {g.stocks.map((s) => (
                <Chip key={s.asset} stock={s} on={s.asset === value} onPress={() => onChange(s.asset)} />
              ))}
            </ScrollView>
            <LinearGradient pointerEvents="none" colors={[t.rowFadeFrom, t.rowFadeTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fade} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** `.sh-chip`: the chosen one ringed twice in vermilion over its wash. */
function Chip({ stock, on, onPress }: { stock: ShortStock; on: boolean; onPress: () => void }) {
  const { color, name } = useTheme();
  const t = basketsShortTokens(name);
  const live = stock.liveCount > 0;
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={nameOfAsset(stock.asset)}
      style={[
        styles.chip,
        { backgroundColor: color.surface1, borderColor: on ? color.accent : color.hairline },
        on ? { boxShadow: `0px 0px 0px 1px ${color.accent}` } : null,
      ]}
    >
      {on ? <LinearGradient pointerEvents="none" colors={[color.accentWash, t.chipWashEnd]} locations={[0, 0.8]} style={styles.chipWash} /> : null}
      <View style={styles.chipTop}>
        <AssetDisc asset={stock.asset} size={26} />
        <View style={styles.chipNames}>
          <Text style={[styles.chipName, { color: color.ink }]} numberOfLines={1}>
            {nameOfAsset(stock.asset)}
          </Text>
          <Text style={[styles.chipTag, { color: color.accent }]} numberOfLines={1}>
            ${stock.asset}
          </Text>
        </View>
      </View>
      <View style={styles.chipBottom}>
        <View style={[styles.chipDot, live ? { backgroundColor: color.profit, boxShadow: `0px 0px 0px 3px ${color.profitWash}` } : { backgroundColor: color.inkMuted }]} />
        <PriceLine asset={stock.asset} style={styles.chipPrice} pending={{ width: 52, height: 10 }} />
      </View>
    </Pressable>
  );
}

/** web's `ShortPickSummary` (`.sh-pick`): the chosen name in full, once — kind, whether it trades now or when, price and week. */
export function ShortPickSummary({ stock, marks }: { stock: ShortStock; marks: DeskMarks | null }) {
  const { color } = useTheme();
  const live = stock.liveCount > 0;
  const next = stock.windows[0];
  const line = lineOf(stock, marks);
  const whenInk = live ? color.profit : color.inkMuted;
  return (
    <View style={[styles.pick, { backgroundColor: color.surface2, borderColor: color.hairline }]} accessibilityLiveRegion="polite">
      <AssetDisc asset={stock.asset} size={34} />
      <View style={styles.pickText}>
        <Text style={[styles.pickName, { color: color.ink }]} numberOfLines={1}>
          {nameOfAsset(stock.asset)}
        </Text>
        <View style={styles.sub}>
          <Text style={[styles.tag, { color: color.accent }]}>${stock.asset}</Text>
          <Text style={[styles.kind, { color: stock.kind === "stock" ? color.inkMuted : color.inkSecondary }]}>{P.kind[stock.kind]}</Text>
          <View style={styles.when}>
            <View style={[styles.whenDot, { backgroundColor: whenInk }, live ? { boxShadow: `0px 0px 0px 3px ${color.profitWash}` } : null]} />
            <Text style={[styles.whenText, { color: whenInk }]}>{live ? P.liveNow : next ? P.opens(opensAt(next.tradingStartSec)) : P.closed}</Text>
          </View>
        </View>
      </View>
      <View style={styles.pickRight}>
        <PriceLine asset={stock.asset} />
        {line.length > 1 ? <Sparkline values={line} width={88} height={26} boxWidth={64} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 14 },
  group: { gap: 8 },
  groupLabel: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.4, textTransform: "uppercase" },
  row: { gap: CHIP_GAP, paddingTop: 2, paddingRight: 2, paddingBottom: 6, paddingLeft: 2 },
  fade: { position: "absolute", top: 0, bottom: 0, right: 0, width: "18%" },
  chip: { width: CHIP_W, gap: 6, paddingVertical: 9, paddingHorizontal: 10, borderWidth: 1, borderRadius: 12 },
  chipWash: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: 11 },
  chipTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  chipNames: { flexShrink: 1 },
  chipName: { fontFamily: FONT.heading, fontSize: 13, lineHeight: 15.6 },
  chipTag: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  chipBottom: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 18 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipPrice: { flexShrink: 1, fontSize: 11.5, lineHeight: 18.4 },
  pick: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: 14 },
  pickText: { flex: 1, gap: 4 },
  pickName: { fontFamily: FONT.headingHeavy, fontSize: 16, lineHeight: 25.6, letterSpacing: -0.16 },
  sub: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  tag: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  kind: { fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6 },
  when: { flexDirection: "row", alignItems: "center", gap: 6 },
  whenDot: { width: 6, height: 6, borderRadius: 3, opacity: 0.8 },
  whenText: { fontFamily: FONT.dataRegular, fontSize: 10.5, lineHeight: 16.8, letterSpacing: 0.21 },
  pickRight: { flexShrink: 0, alignItems: "flex-end", gap: 4 },
});
