import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, useTheme } from "~/theme";

/**
 * web's desk-kit `Sparkline` (`components/ui/desk-kit/charts.tsx`): a week's line in its own direction's ink over a
 * faint area; an empty slot of the same size before two points exist, so the row never jumps when the marks land.
 */
export function Sparkline({ values, width = 96, height = 28 }: { values: readonly number[]; width?: number; height?: number }) {
  const { color } = useTheme();
  if (values.length < 2) return <View style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => [(i / (values.length - 1)) * width, height - 2 - ((v - min) / span) * (height - 4)] as const);
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const first = values[0] ?? 0;
  const last = values.at(-1) ?? 0;
  const ink = last > first ? color.profit : last < first ? color.loss : color.inkMuted;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} accessibilityElementsHidden importantForAccessibility="no">
      <Defs>
        <LinearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={ink} stopOpacity={0.22} />
          <Stop offset="1" stopColor={ink} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#spark)" />
      <Path d={line} stroke={ink} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

/** web's desk-kit `LogoStack`: overlapping company discs, a "+N" cell past `max`; the names are for VoiceOver. */
export function LogoStack({ symbols, names, max = 5, size = 24 }: { symbols: readonly string[]; names: readonly string[]; max?: number; size?: number }) {
  const { color } = useTheme();
  const shown = symbols.slice(0, max);
  const more = symbols.length - shown.length;
  return (
    <View style={styles.stack} accessible accessibilityRole="image" accessibilityLabel={names.join(", ")}>
      {shown.map((symbol, i) => (
        <View
          key={symbol}
          style={[styles.cell, { marginLeft: i === 0 ? 0 : -size / 3, zIndex: shown.length - i, borderColor: color.surface1, borderRadius: size }]}
        >
          <AssetDisc asset={symbol} size={size} />
        </View>
      ))}
      {more > 0 ? (
        <View style={[styles.more, { width: size, height: size, borderRadius: size, marginLeft: -size / 3, backgroundColor: color.surface2, borderColor: color.surface1 }]}>
          <Text style={[styles.moreText, { color: color.inkSecondary }]}>+{more}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { flexDirection: "row", alignItems: "center" },
  cell: { borderWidth: 2 },
  more: { borderWidth: 2, alignItems: "center", justifyContent: "center" },
  moreText: { fontFamily: FONT.data, fontSize: 10 },
});
