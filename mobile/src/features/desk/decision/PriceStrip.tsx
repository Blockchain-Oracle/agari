import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Pattern, Rect, Stop } from "react-native-svg";
import { DECISION } from "@/features/desk/decision/copy-decision";
import { pct, usdText } from "@/features/desk/format";
import { FONT } from "~/theme";
import { useDeskTheme } from "../kit";

const S = DECISION.strip;

export interface StripInput {
  /** Decimal strings from the record, e.g. "104.64276840". */
  spot: string;
  mark: string | null;
  mean30m: string;
  index: string | null;
  /** The desk's premium ceiling in bps over the mark, when known. */
  ceilingBps: number | null;
}

type MarkerId = "spot" | "mark" | "mean" | "index";
interface Marker {
  id: MarkerId;
  label: string;
  value: number;
  text: string;
}

/** `.dc-strip-dot`: pops in (scale 0.4 → 1) one after another. */
function Dot({ id, at, i, ink }: { id: MarkerId; at: number; i: number; ink: string }) {
  const { color } = useDeskTheme();
  const reduce = useReducedMotion();
  const shown = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    shown.value = reduce ? 1 : withDelay(100 + i * 80, withTiming(1, { duration: 350 }));
  }, [reduce, shown, i]);
  const pop = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ scale: 0.4 + shown.value * 0.6 }] }));
  const size = id === "spot" ? 20 : id === "mean" ? 28 : 16;
  const look =
    id === "mean"
      ? { borderWidth: 2, borderColor: color.profit, backgroundColor: "transparent", zIndex: 3 }
      : { borderWidth: 3, borderColor: color.surface1, backgroundColor: ink, boxShadow: `0 0 0 1px ${ink}`, zIndex: id === "spot" ? 2 : 1 };
  return <Animated.View style={[styles.dot, { left: `${at}%`, width: size, height: size, borderRadius: size / 2, marginLeft: -size / 2, marginTop: -size / 2 }, look, pop]} />;
}

/**
 * What it saw, on one axis (web's decision/PriceStrip.tsx): the token price, its mark, its half-hour average and Pyth's
 * index when the venue may read it, with the zone above the premium ceiling hatched. The record's decimals become
 * numbers only here, to place dots; every figure printed is the record's own string.
 */
export function PriceStrip({ spot, mark, mean30m, index, ceilingBps }: StripInput) {
  const { color, t } = useDeskTheme();
  const markers: Marker[] = [
    { id: "spot" as const, label: S.token, value: Number(spot), text: usdText(spot) },
    ...(mark !== null ? [{ id: "mark" as const, label: S.mark, value: Number(mark), text: usdText(mark) }] : []),
    { id: "mean" as const, label: S.mean, value: Number(mean30m), text: usdText(mean30m) },
    ...(index !== null ? [{ id: "index" as const, label: S.index, value: Number(index), text: usdText(index) }] : []),
  ].filter((m) => Number.isFinite(m.value) && m.value > 0);
  if (markers.length < 2) return null;
  const markValue = mark !== null ? Number(mark) : null;
  const ceiling = markValue !== null && ceilingBps !== null ? markValue * (1 + ceilingBps / 10_000) : null;
  const values = [...markers.map((m) => m.value), ...(ceiling !== null ? [ceiling] : [])];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.18, hi * 0.004);
  const min = lo - pad;
  const max = hi + pad;
  const at = (v: number) => ((v - min) / (max - min)) * 100;
  const ink: Record<MarkerId, string> = { spot: color.accent, mark: color.ink, mean: color.profit, index: color.warning };
  return (
    <View style={[styles.strip, { backgroundColor: color.surface2 }]} accessibilityLabel={S.aria}>
      <View style={styles.track}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="strip" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={t.stripFrom} />
              <Stop offset="1" stopColor={t.stripTo} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" rx={5} fill="url(#strip)" />
        </Svg>
        {ceiling !== null ? (
          <View style={[styles.band, { left: `${at(ceiling)}%`, borderLeftColor: color.accent }]}>
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
              <Defs>
                <Pattern id="hatch" width={12} height={12} patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
                  <Rect x="0" y="0" width={6} height={12} fill={color.accentWash} />
                </Pattern>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#hatch)" />
            </Svg>
            <Text style={[styles.bandLabel, { color: color.accent }]} numberOfLines={1}>
              {S.ceiling(pct(ceilingBps ?? 0))}
            </Text>
          </View>
        ) : null}
        {markers.map((m, i) => (
          <Dot key={m.id} id={m.id} at={at(m.value)} i={i} ink={ink[m.id]} />
        ))}
      </View>
      <View style={styles.legend}>
        {markers.map((m) => (
          <View key={m.id} style={styles.key}>
            <View style={[styles.swatch, m.id === "mean" ? { borderWidth: 2, borderColor: color.profit } : { backgroundColor: ink[m.id] }]} />
            <Text style={[styles.keyLabel, { color: color.inkSecondary }]}>{m.label}</Text>
            <Text style={[styles.keyValue, { color: color.ink }]}>{m.text}</Text>
          </View>
        ))}
        {ceiling !== null ? (
          <View style={styles.key}>
            <View style={[styles.swatch, styles.square, { borderWidth: 1, borderColor: color.accent, backgroundColor: color.accentWash }]} />
            <Text style={[styles.keyLabel, { color: color.inkSecondary }]}>{S.above}</Text>
            <Text style={[styles.keyValue, { color: color.ink }]}>{S.over(`$${ceiling.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: 14, paddingTop: 18, paddingHorizontal: 16, paddingBottom: 14, borderRadius: 14 },
  track: { height: 10, marginTop: 18, marginHorizontal: 6, marginBottom: 4, borderRadius: 9999 },
  band: { position: "absolute", top: -6, bottom: -6, right: -6, borderLeftWidth: 2, borderStyle: "dashed", borderTopRightRadius: 9999, borderBottomRightRadius: 9999, overflow: "visible" },
  bandLabel: { position: "absolute", bottom: 26, right: 4, fontFamily: FONT.body, fontSize: 10.5, lineHeight: 16.8 },
  dot: { position: "absolute", top: "50%" },
  legend: { flexDirection: "row", flexWrap: "wrap", rowGap: 8, columnGap: 18 },
  key: { flexDirection: "row", alignItems: "center", gap: 7 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  square: { borderRadius: 3 },
  keyLabel: { fontFamily: FONT.body, fontSize: 12.5, lineHeight: 20 },
  keyValue: { fontFamily: FONT.bodyStrong, fontSize: 12.5, lineHeight: 20, fontVariant: ["tabular-nums"] },
});
