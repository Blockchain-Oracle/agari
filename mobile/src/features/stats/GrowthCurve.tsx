import { StyleSheet, Text } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Polygon, Polyline, Stop, Text as SvgText } from "react-native-svg";
import { STATS } from "@/features/stats/copy";
import { FONT, useTheme } from "~/theme";
import { statsTokens } from "~/theme/web/explore/stats";

const W = 920;
const PAD_X = 16;
const PAD_T = 22;
const PAD_B = 26;

/**
 * web's `GrowthCurve` (features/stats/GrowthCurve.tsx): the cumulative callers curve in a 920-wide viewBox stretched
 * to the card with `preserveAspectRatio="none"`, exactly as web stretches it on a phone — dots flatten to ticks, the
 * axis caption squeezes. One point is a dot; two or more a line over the emerald fill. No smoothing.
 */
export function GrowthCurve({ points, height = 200 }: { points: readonly { atMs: number; cumulative: number }[]; height?: number }) {
  const { name, color } = useTheme();
  const t = statsTokens(name);
  if (points.length === 0) return <Text style={[styles.empty, { color: color.inkDisabled }]}>{STATS.curve.empty}</Text>;

  const H = height;
  const max = Math.max(1, ...points.map((p) => p.cumulative));
  const xAt = (i: number) => (points.length === 1 ? W / 2 : PAD_X + (i / (points.length - 1)) * (W - 2 * PAD_X));
  const yAt = (v: number) => H - PAD_B - (v / max) * (H - PAD_T - PAD_B);
  const pts = points.map((p, i) => ({ x: xAt(i), y: yAt(p.cumulative) }));
  const line = pts.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ");
  const lastX = points.length === 1 ? W / 2 : W - PAD_X;
  const area = `${PAD_X},${H - PAD_B} ${line} ${lastX.toFixed(1)},${H - PAD_B}`;

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" accessibilityRole="image" accessibilityLabel={`${STATS.curve.axis}: ${max}`}>
      <Defs>
        <LinearGradient id="stats-gc" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color.profit} stopOpacity={0.28} />
          <Stop offset="1" stopColor={color.profit} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {[0.25, 0.5, 0.75].map((g) => {
        const y = PAD_T + g * (H - PAD_T - PAD_B);
        return <Line key={g} x1={PAD_X} x2={W - PAD_X} y1={y} y2={y} stroke={t.grid} strokeWidth={1} />;
      })}
      <Polygon points={area} fill="url(#stats-gc)" />
      {pts.length > 1 ? (
        <>
          {/* the line's drop-shadow glow, drawn as a wide soft stroke under it */}
          <Polyline points={line} fill="none" stroke={t.profitGlow} strokeWidth={8} strokeLinejoin="round" />
          <Polyline points={line} fill="none" stroke={color.profit} strokeWidth={2.5} strokeLinejoin="round" />
        </>
      ) : null}
      {pts.map((q, i) => (
        <Circle key={i} cx={q.x} cy={q.y} r={i === pts.length - 1 ? 5 : 3} fill={color.profit} />
      ))}
      <SvgText x={PAD_X} y={14} fill={color.inkDisabled} fontFamily={FONT.dataRegular} fontSize={9} letterSpacing={2}>
        {STATS.curve.axis}
      </SvgText>
      <SvgText x={W - PAD_X} y={14} textAnchor="end" fill={color.profit} fontFamily={FONT.dataStrong} fontSize={12}>
        {String(max)}
      </SvgText>
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, paddingVertical: 64, textAlign: "center" },
});
