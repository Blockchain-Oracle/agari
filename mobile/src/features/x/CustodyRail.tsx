import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, G, Line, Marker, Path, RadialGradient, Rect, Text as SvgText } from "react-native-svg";
import { Stop, stopPaint } from "~/components/ui/SvgStop";
import { FONT, useTheme } from "~/theme";
import { tradeXTokens } from "~/theme/web/products/trade-x";
import { E_DRAW, loopAt, onceAt, svgRepaint, useSvgClock } from "./motion";

/** Piecewise-linear interpolation, CSS keyframes style: `at` rises through `xs`, clamped at both ends. */
function lerp(at: number, xs: readonly number[], ys: readonly number[]): number {
  if (at <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (at <= xs[i]) return ys[i - 1] + ((ys[i] - ys[i - 1]) * (at - xs[i - 1])) / (xs[i] - xs[i - 1] || 1);
  }
  return ys[ys.length - 1];
}

type Pt = readonly [number, number];

/**
 * The attack dot's `animateMotion` path (M150,48 C205,62 214,88 232,106 L252,124 L252,190), sampled by arc length so
 * the dot travels it at web's even speed; keyPoints 0 → 0.62 over keyTimes 0 → 0.42, then it rests where the seal is.
 */
function attackSamples(count: number): { x: number[]; y: number[] } {
  const pts: Pt[] = [];
  for (let i = 0; i <= 120; i++) {
    const s = i / 120;
    const u = 1 - s;
    pts.push([
      u * u * u * 150 + 3 * u * u * s * 205 + 3 * u * s * s * 214 + s * s * s * 232,
      u * u * u * 48 + 3 * u * u * s * 62 + 3 * u * s * s * 88 + s * s * s * 106,
    ]);
  }
  pts.push([252, 124], [252, 190]);
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = acc[acc.length - 1];
  const x: number[] = [];
  const y: number[] = [];
  for (let k = 0; k <= count; k++) {
    const target = (k / count) * 0.62 * total;
    let j = 1;
    while (j < acc.length - 1 && acc[j] < target) j++;
    const f = (target - acc[j - 1]) / (acc[j] - acc[j - 1] || 1);
    x.push(pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * f);
    y.push(pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * f);
  }
  return { x, y };
}
const ATTACK = attackSamples(32);
const ATTACK_TIMES = ATTACK.x.map((_, k) => (k / 32) * 0.42);

/** web's CustodyRail.tsx, the hero proof: a mention → a bounded agent → a position that is yours; no withdraw door. */
export function CustodyRail({ handle }: { handle: string }) {
  const t = tradeXTokens(useTheme().name);
  const ms = useSvgClock();
  const [box, setBox] = useState({ w: 0, h: 0 });
  // xt-flow: the dashes march 17 units a cycle.
  const flow = -17 * loopAt(ms, 1050);
  const flowM = -17 * loopAt(ms, 1250);
  const hexDraw = onceAt(ms, 900, 700, E_DRAW);
  // xt-shake: 0,36,48,100% at rest; 39% −2.5, 42% +2.5, 45% −1.5 .
  const shakeX = lerp(loopAt(ms, 6000), [0, 0.36, 0.39, 0.42, 0.45, 0.48, 1], [0, 0, -2.5, 2.5, -1.5, 0, 0]);
  const attack = loopAt(ms, 6000);
  const dotX = lerp(attack, ATTACK_TIMES, ATTACK.x);
  const dotY = lerp(attack, ATTACK_TIMES, ATTACK.y);
  const dotOpacity = lerp(attack, [0, 0.05, 0.4, 0.46, 1], [0, 1, 1, 0, 0]);
  return (
    <View accessibilityLabel="The agent can only open a position you own; there is no withdraw path.">
      <View style={[styles.rail, { borderColor: t.railBorder }]}>
        <LinearGradient colors={[t.railTop, t.clear]} style={[StyleSheet.absoluteFill, styles.railFill]} />
        <View style={styles.canvas} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {box.w > 0 ? (
          <Svg width={box.w - svgRepaint(ms)} height={box.h} viewBox="0 0 440 300">
            <Defs>
              <RadialGradient id="xtGlow" cx="50%" cy="42%" r="55%">
                <Stop offset="0" {...stopPaint(t.v, 0.1)} />
                <Stop offset="1" {...stopPaint(t.v, 0)} />
              </RadialGradient>
              <Marker id="xtArrM" markerWidth={7} markerHeight={7} refX={5.5} refY={3} orient="auto">
                <Path d="M0,0 L6,3 L0,6 Z" fill={t.m} />
              </Marker>
            </Defs>
            <Rect x={150} y={70} width={200} height={110} fill="url(#xtGlow)" />
            <Path d="M182,48 C214,58 220,88 232,106" fill="none" stroke={t.v} strokeWidth={1.6} opacity={0.9} strokeDasharray="2.5 6" strokeDashoffset={flow} />
            <Path d="M272,116 L346,116" fill="none" stroke={t.v} strokeWidth={1.6} opacity={0.9} strokeDasharray="2.5 6" strokeDashoffset={flow} />
            <Path d="M398,146 C398,214 320,262 292,262" fill="none" stroke={t.m} strokeWidth={1.8} strokeDasharray="2.5 6" strokeDashoffset={flowM} markerEnd="url(#xtArrM)" />
            <Path d="M252,142 L252,190" fill="none" stroke={t.v} strokeWidth={1.4} strokeDasharray="3 4" opacity={0.55} />
            <Rect x={6} y={32} width={176} height={32} rx={8} fill={t.paper} stroke={t.railPaperStroke} />
            <SvgText x={16} y={52} fontSize={11} fontFamily={FONT.dataRegular} fill={t.wire}>{`${handle} tsla up 5 15m`}</SvgText>
            <Path d="M252,90 L280,106 L280,138 L252,154 L224,138 L224,106 Z" fill={t.agent} stroke={t.v} strokeWidth={1.4} strokeDasharray="300 300" strokeDashoffset={300 * (1 - hexDraw)} />
            <SvgText x={252} y={126} textAnchor="middle" fontSize={9.5} fontFamily={FONT.dataRegular} fill={t.v}>agent</SvgText>
            <SvgText x={252} y={172} textAnchor="middle" fontSize={8.5} fontFamily={FONT.dataRegular} fill={t.muted}>bounded key · placeFor</SvgText>
            <Rect x={346} y={92} width={88} height={50} rx={10} fill={t.mintPaper} stroke={t.m} strokeOpacity={0.5} />
            <SvgText x={390} y={112} textAnchor="middle" fontSize={10} fontFamily={FONT.dataRegular} fill={t.mintInk}>TSLA · yours</SvgText>
            <SvgText x={390} y={130} textAnchor="middle" fontSize={12} fontFamily={FONT.dataStrong} fill={t.m}>5.00</SvgText>
            <SvgText x={390} y={160} textAnchor="middle" fontSize={8} fontFamily={FONT.dataRegular} fill={t.m} opacity={0.8}>unchanged</SvgText>
            <Rect x={212} y={248} width={80} height={28} rx={9} fill={t.paper} stroke={t.railYouStroke} />
            <SvgText x={252} y={266} textAnchor="middle" fontSize={11} fontFamily={FONT.dataRegular} fill={t.wire}>you</SvgText>
            <G transform={`translate(${shakeX}, 0)`}>
              <Rect x={150} y={189} width={204} height={32} rx={8} fill={t.seal} stroke={t.v} strokeOpacity={0.5} />
              <G transform="translate(167,205)">
                <Rect x={-5} y={-3} width={10} height={7.5} rx={1.5} fill="none" stroke={t.v} strokeWidth={1.2} />
                <Path d="M-2.5,-3 v-2 a2.5,2.5 0 0 1 5,0 v2" fill="none" stroke={t.v} strokeWidth={1.2} />
                <Line x1={-7.5} y1={6} x2={7.5} y2={-6.5} stroke={t.v} strokeWidth={1.3} />
              </G>
              <SvgText x={183} y={208.5} fontSize={8.5} fontFamily={FONT.dataRegular} fill={t.sealText}>withdrawTo() · transfer() · sweepTo()</SvgText>
              <Line x1={183} y1={205} x2={347} y2={205} stroke={t.v} strokeWidth={1} strokeOpacity={0.55} />
            </G>
            <SvgText x={252} y={235} textAnchor="middle" fontSize={8.5} fontFamily={FONT.dataRegular} fill={t.faint}>no such function for the agent</SvgText>
            <Circle r={3.4} cx={dotX} cy={dotY} fill={t.v} opacity={dotOpacity} />
          </Svg>
          ) : null}
        </View>
      </View>
      <Text style={[styles.cap, { color: t.gray400 }]}>
        you mention → the agent opens → <Text style={{ color: t.gray200 }}>the position is yours.</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { borderRadius: 16, borderWidth: 1, padding: 12, overflow: "hidden" },
  railFill: { borderRadius: 15 },
  canvas: { width: "100%", aspectRatio: 440 / 300 },
  cap: { marginTop: 12, fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
});
