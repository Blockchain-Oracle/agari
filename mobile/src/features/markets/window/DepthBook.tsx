import type { BookLevelView, EventMarket } from "@agari/core/types";
import { bpsToOddsCents, formatBaseUnits } from "@agari/core/units";
import { useBook } from "@agari/markets/react";
import { StyleSheet, Text, View } from "react-native";
import { HERO } from "@/lib/copy";
import { ReadingView } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";

const DEPTH = 3;

/**
 * web's DepthStrip: the top of the real book for both sides, what you pay to buy each. An empty side says so; a bar
 * behind each level is its size against the deepest level shown, so the book's shape reads at a glance.
 */
export function DepthBook({ market }: { market: EventMarket }) {
  const book = useBook({ marketId: market.marketId, poolAddress: market.poolAddress, decimals: market.decimals });
  return (
    <ReadingView reading={book} loading="list">
      {(depth) => {
        const up = depth.upAsks.slice(0, DEPTH);
        const down = depth.downAsks.slice(0, DEPTH);
        const deepest = [...up, ...down].reduce((max, level) => (level.quantityRaw > max ? level.quantityRaw : max), 0n);
        return (
          <View style={styles.columns}>
            <Column title={HERO.buyUp} asks={up} decimals={depth.decimals} deepest={deepest} side="up" />
            <Column title={HERO.buyDown} asks={down} decimals={depth.decimals} deepest={deepest} side="down" />
          </View>
        );
      }}
    </ReadingView>
  );
}

function Column({ title, asks, decimals, deepest, side }: { title: string; asks: BookLevelView[]; decimals: number; deepest: bigint; side: "up" | "down" }) {
  const { color } = useTheme();
  const ink = side === "up" ? color.profit : color.loss;
  const wash = side === "up" ? color.profitWash : color.lossWash;
  return (
    <View style={styles.column}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{title}</Text>
      {asks.length === 0 ? (
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{HERO.noDepth}</Text>
      ) : (
        asks.map((level) => {
          const share = deepest > 0n ? Number((level.quantityRaw * 100n) / deepest) : 0;
          const cents = bpsToOddsCents(level.priceBps);
          const size = formatBaseUnits(level.quantityRaw, decimals, { minDp: 0 });
          return (
            <View key={level.priceRaw.toString()} style={styles.level} accessibilityLabel={`${cents} cents, ${size} ${HERO.contracts}`}>
              <View style={[styles.bar, { width: `${share}%`, backgroundColor: wash }]} />
              <Text style={[TYPE.data, { color: ink }]}>{cents}¢</Text>
              <Text style={[TYPE.data, { color: color.inkSecondary }]} numberOfLines={1}>
                {size}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: "row", gap: 16 },
  column: { flex: 1, gap: 6 },
  level: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: 28, paddingHorizontal: 8, borderRadius: 4, overflow: "hidden" },
  bar: { position: "absolute", right: 0, top: 0, bottom: 0 },
});
