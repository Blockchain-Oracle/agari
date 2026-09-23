import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { DECISION } from "@/features/desk/decision/copy-decision";
import { pct, usdText } from "@/features/desk/format";
import { RADIUS, TYPE, useTheme } from "~/theme";

const S = DECISION.strip;

interface Marker {
  id: "spot" | "mark" | "mean" | "index";
  label: string;
  value: number;
  text: string;
}

/**
 * What it saw, on one axis (web's decision/PriceStrip.tsx): the token price, its mark, its half-hour average and
 * Pyth's index when present, with the zone above the premium ceiling shaded. Every figure printed is the record's
 * own string; the decimals become numbers only to place the dots.
 */
export function PriceStrip({ spot, mark, mean30m, index, ceilingBps }: { spot: string; mark: string | null; mean30m: string; index: string | null; ceilingBps: number | null }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const tint: Record<Marker["id"], string> = { spot: color.accent, mark: color.ink, mean: color.info, index: color.profit };
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
  const at = (v: number) => ((v - (lo - pad)) / (hi + pad - (lo - pad))) * width;
  return (
    <View style={styles.wrap} accessible accessibilityLabel={`${S.aria}: ${markers.map((m) => `${m.label} ${m.text}`).join(", ")}`}>
      <View style={[styles.track, { backgroundColor: color.surface2 }]} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {ceiling !== null && width > 0 ? <View style={[styles.band, { left: at(ceiling), backgroundColor: color.lossWash, borderLeftColor: color.loss }]} /> : null}
        {width > 0
          ? markers.map((m, i) => (
              <Animated.View key={m.id} entering={reduce ? undefined : FadeIn.delay(100 + i * 80)} style={[styles.dot, { left: at(m.value) - 7, backgroundColor: tint[m.id], borderColor: color.ground }]} />
            ))
          : null}
      </View>
      <View style={styles.legend}>
        {markers.map((m) => (
          <View key={m.id} style={styles.key}>
            <View style={[styles.swatch, { backgroundColor: tint[m.id] }]} />
            <Text style={[TYPE.caption, styles.grow, { color: color.inkSecondary }]}>{m.label}</Text>
            <Text style={[TYPE.data, { color: color.ink }]}>{m.text}</Text>
          </View>
        ))}
        {ceiling !== null ? (
          <View style={styles.key}>
            <View style={[styles.swatch, { backgroundColor: color.loss }]} />
            <Text style={[TYPE.caption, styles.grow, { color: color.inkSecondary }]}>
              {S.above} ({S.ceiling(pct(ceilingBps ?? 0))})
            </Text>
            <Text style={[TYPE.data, { color: color.ink }]}>{S.over(`$${ceiling.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  track: { height: 14, borderRadius: RADIUS.full, justifyContent: "center" },
  band: { position: "absolute", top: 0, bottom: 0, right: 0, borderLeftWidth: 2, borderTopRightRadius: RADIUS.full, borderBottomRightRadius: RADIUS.full },
  dot: { position: "absolute", width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  legend: { gap: 4 },
  key: { flexDirection: "row", alignItems: "center", gap: 8 },
  swatch: { width: 8, height: 8, borderRadius: 4 },
  grow: { flex: 1 },
});
