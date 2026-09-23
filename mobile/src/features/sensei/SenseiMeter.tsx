import { formatClock } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Line, Polyline } from "react-native-svg";
import { assetPriceLine } from "@/features/markets/hero/units";
import { SENSEI_UI } from "@/features/sensei/copy";
import type { SenseiReading } from "@/features/sensei/useSenseiSnapshot";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

const W = 300;
const H = 44;

/** web's `CardSpark` inside the meter: the tape, with the opening line dashed across it. */
function Tape({ reading }: { reading: SenseiReading }) {
  const { color } = useTheme();
  const values = reading.points.map((p) => Number(p.valueRaw));
  if (values.length < 2) return <View style={{ height: H }} />;
  const opening = reading.nearest?.openingPriceRaw ?? null;
  const all = opening === null ? values : [...values, Number(opening)];
  const min = Math.min(...all);
  const span = Math.max(...all) - min || 1;
  const y = (v: number) => H - ((v - min) / span) * (H - 4) - 2;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * W},${y(v)}`).join(" ");
  const direction = reading.drift?.direction ?? "flat";
  const ink = direction === "up" ? color.profit : direction === "down" ? color.loss : color.inkSecondary;
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" accessible={false}>
      {opening !== null ? <Line x1={0} x2={W} y1={y(Number(opening))} y2={y(Number(opening))} stroke={color.inkMuted} strokeDasharray="4 4" strokeWidth={1} /> : null}
      <Polyline points={points} fill="none" stroke={ink} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * web's `SenseiMeter`: the pinned strip every reply sits under — the nearest Window's price, its drift over the span
 * actually held, the time left (vermilion under the wire) and the tape.
 */
export function SenseiMeter({ reading, secsLeft, urgent }: { reading: SenseiReading; secsLeft: number; urgent: boolean }) {
  const { color } = useTheme();
  const { latestRaw, drift, nearest } = reading;
  const asset = nearest?.asset ?? "";
  const driftInk = drift?.direction === "up" ? color.profit : drift?.direction === "down" ? color.loss : color.inkSecondary;
  const move = drift && drift.direction !== "flat"
    ? `${drift.moveRaw > 0n ? "+" : "−"}${assetPriceLine(asset, drift.moveRaw < 0n ? -drift.moveRaw : drift.moveRaw, latestRaw ?? undefined)}`
    : SENSEI_UI.flat;
  return (
    <View style={[styles.meter, { backgroundColor: color.surface1, borderColor: urgent ? color.accent : color.hairline }]}>
      <View style={styles.read}>
        {nearest ? <AssetDisc asset={nearest.asset} size={22} /> : null}
        <Text style={[TYPE.dataLg, { color: color.ink }]}>{latestRaw === null ? SENSEI_UI.reading : assetPriceLine(asset, latestRaw)}</Text>
        {drift ? (
          <Text style={[styles.drift, { color: driftInk }]}>
            {move} · {SENSEI_UI.minute(drift.spanMin)}
          </Text>
        ) : null}
        <View style={styles.spacer} />
        {nearest ? (
          <Text style={[TYPE.data, { color: urgent ? color.accent : color.ink }]}>
            {formatClock(secsLeft)} <Text style={{ color: color.inkMuted }}>{SENSEI_UI.left}</Text>
          </Text>
        ) : null}
      </View>
      <Tape reading={reading} />
    </View>
  );
}

const styles = StyleSheet.create({
  meter: { borderRadius: RADIUS.lg, borderWidth: 1, padding: 12, gap: 8 },
  read: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  drift: { fontFamily: FONT.data, fontSize: 12 },
  spacer: { flex: 1 },
});
