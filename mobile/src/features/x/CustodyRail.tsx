import { LinearGradient } from "expo-linear-gradient";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, G, Line, Marker, Path, RadialGradient, Rect, Stop, Text as SvgText } from "react-native-svg";
import { FONT, useTheme } from "~/theme";
import { tradeXTokens } from "~/theme/web/products/trade-x";
import { E_DRAW, useLoop, useOnce } from "./motion";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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
  const flow = useLoop(1050, Easing.linear, false);
  const flowM = useLoop(1250, Easing.linear, false);
  const shake = useLoop(6000, Easing.linear, false);
  const attack = useLoop(6000, Easing.linear, false);
  const nodeDraw = useOnce(900, 700, E_DRAW, false);
  const dash = (v: Animated.Value) => v.interpolate({ inputRange: [0, 1], outputRange: [0, -17] });
  // xt-shake: 0,36,48,100% at rest; 39% −2.5, 42% +2.5, 45% −1.5 .
  const shakeX = shake.interpolate({ inputRange: [0, 0.36, 0.39, 0.42, 0.45, 0.48, 1], outputRange: [0, 0, -2.5, 2.5, -1.5, 0, 0] });
  const dotX = attack.interpolate({ inputRange: [...ATTACK_TIMES, 1], outputRange: [...ATTACK.x, ATTACK.x[ATTACK.x.length - 1]] });
  const dotY = attack.interpolate({ inputRange: [...ATTACK_TIMES, 1], outputRange: [...ATTACK.y, ATTACK.y[ATTACK.y.length - 1]] });
  const dotOpacity = attack.interpolate({ inputRange: [0, 0.05, 0.4, 0.46, 1], outputRange: [0, 1, 1, 0, 0] });
  const hexOffset = nodeDraw.interpolate({ inputRange: [0, 1], outputRange: [300, 0] });
  return (
    <View accessibilityLabel="The agent can only open a position you own; there is no withdraw path.">
      <View style={[styles.rail, { borderColor: t.railBorder }]}>
        <LinearGradient colors={[t.railTop, t.clear]} style={[StyleSheet.absoluteFill, styles.railFill]} />
        <View style={styles.canvas}>
          <Svg width="100%" height="100%" viewBox="0 0 440 300">
            <Defs>
              <RadialGradient id="xtGlow" cx="50%" cy="42%" r="55%">
                <Stop offset="0" stopColor={t.v} stopOpacity={0.1} />
                <Stop offset="1" stopColor={t.v} stopOpacity={0} />
              </RadialGradient>
              <Marker id="xtArrM" markerWidth={7} markerHeight={7} refX={5.5} refY={3} orient="auto">
                <Path d="M0,0 L6,3 L0,6 Z" fill={t.m} />
              </Marker>
            </Defs>
            <Rect x={150} y={70} width={200} height={110} fill="url(#xtGlow)" />
            <AnimatedPath d="M182,48 C214,58 220,88 232,106" fill="none" stroke={t.v} strokeWidth={1.6} opacity={0.9} strokeDasharray="2.5 6" strokeDashoffset={dash(flow)} />
            <AnimatedPath d="M272,116 L346,116" fill="none" stroke={t.v} strokeWidth={1.6} opacity={0.9} strokeDasharray="2.5 6" strokeDashoffset={dash(flow)} />
            <AnimatedPath d="M398,146 C398,214 320,262 292,262" fill="none" stroke={t.m} strokeWidth={1.8} strokeDasharray="2.5 6" strokeDashoffset={dash(flowM)} markerEnd="url(#xtArrM)" />
            <Path d="M252,142 L252,190" fill="none" stroke={t.v} strokeWidth={1.4} strokeDasharray="3 4" opacity={0.55} />
            <Rect x={6} y={32} width={176} height={32} rx={8} fill={t.paper} stroke={t.railPaperStroke} />
            <SvgText x={16} y={52} fontSize={11} fontFamily={FONT.dataRegular} fill={t.wire}>{`${handle} tsla up 5 15m`}</SvgText>
            <AnimatedPath d="M252,90 L280,106 L280,138 L252,154 L224,138 L224,106 Z" fill={t.agent} stroke={t.v} strokeWidth={1.4} strokeDasharray="300" strokeDashoffset={hexOffset} />
            <SvgText x={252} y={126} textAnchor="middle" fontSize={9.5} fontFamily={FONT.dataRegular} fill={t.v}>agent</SvgText>
            <SvgText x={252} y={172} textAnchor="middle" fontSize={8.5} fontFamily={FONT.dataRegular} fill={t.muted}>bounded key · placeFor</SvgText>
            <Rect x={346} y={92} width={88} height={50} rx={10} fill={t.mintPaper} stroke={t.m} strokeOpacity={0.5} />
            <SvgText x={390} y={112} textAnchor="middle" fontSize={10} fontFamily={FONT.dataRegular} fill={t.mintInk}>TSLA · yours</SvgText>
            <SvgText x={390} y={130} textAnchor="middle" fontSize={12} fontFamily={FONT.dataStrong} fill={t.m}>5.00</SvgText>
            <SvgText x={390} y={160} textAnchor="middle" fontSize={8} fontFamily={FONT.dataRegular} fill={t.m} opacity={0.8}>unchanged</SvgText>
            <Rect x={212} y={248} width={80} height={28} rx={9} fill={t.paper} stroke={t.railYouStroke} />
            <SvgText x={252} y={266} textAnchor="middle" fontSize={11} fontFamily={FONT.dataRegular} fill={t.wire}>you</SvgText>
            <AnimatedG translateX={shakeX}>
              <Rect x={150} y={189} width={204} height={32} rx={8} fill={t.seal} stroke={t.v} strokeOpacity={0.5} />
              <G transform="translate(167,205)">
                <Rect x={-5} y={-3} width={10} height={7.5} rx={1.5} fill="none" stroke={t.v} strokeWidth={1.2} />
                <Path d="M-2.5,-3 v-2 a2.5,2.5 0 0 1 5,0 v2" fill="none" stroke={t.v} strokeWidth={1.2} />
                <Line x1={-7.5} y1={6} x2={7.5} y2={-6.5} stroke={t.v} strokeWidth={1.3} />
              </G>
              <SvgText x={183} y={208.5} fontSize={8.5} fontFamily={FONT.dataRegular} fill={t.sealText}>withdrawTo() · transfer() · sweepTo()</SvgText>
              <Line x1={183} y1={205} x2={347} y2={205} stroke={t.v} strokeWidth={1} strokeOpacity={0.55} />
            </AnimatedG>
            <SvgText x={252} y={235} textAnchor="middle" fontSize={8.5} fontFamily={FONT.dataRegular} fill={t.faint}>no such function for the agent</SvgText>
            <AnimatedCircle r={3.4} cx={dotX} cy={dotY} fill={t.v} opacity={dotOpacity} />
          </Svg>
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
