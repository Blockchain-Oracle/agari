import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated as RNAnimated, Easing as RNEasing, StyleSheet, Text, View, type DimensionValue } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, useTheme } from "~/theme";
import { basketsShortTokens } from "~/theme/web/products/baskets-short";

const AnimatedPath = Animated.createAnimatedComponent(Path);
/** desk-kit charts.tsx's EASE. */
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * web's desk-kit `Sparkline` (`components/ui/desk-kit/charts.tsx`, `.dkit-spark`): the line in its direction's ink
 * (1.75 px, round) drawn in over 0.9 s, over the matching wash; a dashed floor of the same size before two points.
 */
export function Sparkline({ values, width = 96, height = 28, boxWidth }: {
  values: readonly number[];
  width?: number;
  height?: number;
  /** A phone rule's CSS width over the svg's own (`.bk-index-week .dkit-spark { width: 88px }`): the drawing scales to fit it. */
  boxWidth?: number;
}) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const drawn = useSharedValue(reduce ? 1 : 0);
  const ready = values.length >= 2;
  useEffect(() => {
    if (ready) drawn.value = withTiming(1, { duration: reduce ? 0 : 900, easing: EASE });
  }, [ready, reduce, drawn]);
  const min = ready ? Math.min(...values) : 0;
  const max = ready ? Math.max(...values) : 0;
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * width, height - 2 - ((v - min) / span) * (height - 4)] as const);
  let length = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1] ?? [0, 0];
    const [bx, by] = pts[i] ?? [0, 0];
    length += Math.hypot(bx - ax, by - ay);
  }
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - drawn.value) }));
  if (!ready) return <View style={{ width: boxWidth ?? width, height, borderBottomWidth: 1, borderStyle: "dashed", borderColor: color.hairline }} />;
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const first = values[0] ?? 0;
  const last = values.at(-1) ?? 0;
  const tone = last > first ? "up" : last < first ? "down" : "flat";
  const ink = tone === "up" ? color.profit : tone === "down" ? color.loss : color.inkSecondary;
  const wash = tone === "up" ? color.profitWash : tone === "down" ? color.lossWash : null;
  return (
    <Svg width={boxWidth ?? width} height={height} viewBox={`0 0 ${width} ${height}`} style={styles.spark} accessibilityElementsHidden importantForAccessibility="no">
      <Path d={area} fill={wash ?? ink} fillOpacity={wash ? 1 : 0.12} />
      <AnimatedPath
        d={line}
        stroke={ink}
        strokeWidth={1.75}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={[length, length]}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

/** web's desk-kit `LogoStack` (`.dkit-logos[data-size="sm"]`): 20 px discs overlapping by 30%, a 2 px card-colour ring, "+N". */
export function LogoStack({ symbols, names, max = 4, size = 20 }: { symbols: readonly string[]; names: readonly string[]; max?: number; size?: number }) {
  const { color } = useTheme();
  const shown = symbols.slice(0, max);
  const more = symbols.length - shown.length;
  const cell = (i: number) => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    marginLeft: i === 0 ? 0 : -Math.round(size * 0.3),
    zIndex: shown.length - i,
    backgroundColor: color.surface2,
    boxShadow: `0px 0px 0px 2px ${color.surface1}`,
  });
  return (
    <View style={styles.stack} accessible accessibilityRole="image" accessibilityLabel={names.join(", ")}>
      {shown.map((symbol, i) => (
        <View key={symbol} style={[styles.cell, cell(i)]}>
          <View style={[styles.disc, { borderRadius: size / 2 }]}>
            <AssetDisc asset={symbol} size={size} />
          </View>
        </View>
      ))}
      {more > 0 ? (
        <View style={[styles.cell, cell(shown.length), { zIndex: 0 }]}>
          <Text style={[styles.more, { fontSize: size * 0.36, color: color.ink }]}>+{more}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** web's desk-kit `StatusDot` at `data-tone="live"` (`.dkit-status`): the profit pill with its pinging dot. */
export function LiveStatus({ children }: { children: ReactNode }) {
  const { color, name } = useTheme();
  const t = basketsShortTokens(name);
  const ping = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    const loop = RNAnimated.loop(RNAnimated.timing(ping, { toValue: 1, duration: 1600, easing: RNEasing.bezier(0, 0, 0.2, 1), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [ping]);
  const scale = ping.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 2.2, 2.2] });
  const opacity = ping.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 0, 0] });
  return (
    <View style={[styles.status, { borderColor: t.liveChipBorder }]}>
      <View style={[styles.statusDot, { backgroundColor: color.profit }]}>
        <RNAnimated.View style={[StyleSheet.absoluteFill, styles.statusPing, { backgroundColor: color.profit, opacity, transform: [{ scale }] }]} />
      </View>
      <Text style={[styles.statusText, { color: color.profit }]}>{children}</Text>
    </View>
  );
}

/** web's `.bk-skel` / `.sh-skel`: surface-2 → hairline → surface-2 sweeping across in 1.4 s. */
export function Shimmer({ width, height, radius = 6, label }: { width: DimensionValue; height: number; radius?: number; label?: string }) {
  const { color } = useTheme();
  const [w, setW] = useState(0);
  const sweep = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    const loop = RNAnimated.loop(RNAnimated.timing(sweep, { toValue: 1, duration: 1400, easing: RNEasing.inOut(RNEasing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [sweep]);
  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-w, w] });
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ width, height, borderRadius: radius, overflow: "hidden", backgroundColor: color.surface2 }}
    >
      {w > 0 ? (
        <RNAnimated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
          <LinearGradient colors={[color.surface2, color.hairline, color.surface2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </RNAnimated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  spark: { overflow: "visible" },
  stack: { flexDirection: "row", alignItems: "center" },
  cell: { alignItems: "center", justifyContent: "center" },
  disc: { overflow: "hidden" },
  more: { fontFamily: FONT.dataStrong },
  status: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 10, borderRadius: 9999, borderWidth: 1, alignSelf: "flex-start" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusPing: { borderRadius: 4 },
  statusText: { fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.66, textTransform: "uppercase" },
});
