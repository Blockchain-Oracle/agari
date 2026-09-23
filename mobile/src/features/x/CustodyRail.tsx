import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, G, Line, Marker, Path, Polygon, RadialGradient, Rect, Stop, Text as SvgText } from "react-native-svg";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

/**
 * web's features/x/CustodyRail.tsx, the hero proof: a mention → a bounded agent → a position that is yours, and the
 * withdraw door that does not exist for the agent. Drawn in theme tokens on the same 440×300 canvas.
 */
export function CustodyRail({ handle }: { handle: string }) {
  const { color } = useTheme();
  return (
    <View style={[styles.frame, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
      <Svg viewBox="0 0 440 300" width="100%" height={undefined} style={styles.svg} accessibilityLabel="The agent can only open a position you own; there is no withdraw path.">
        <Defs>
          <RadialGradient id="xtGlow" cx="50%" cy="42%" r="55%">
            <Stop offset="0" stopColor={color.accent} stopOpacity={0.12} />
            <Stop offset="1" stopColor={color.accent} stopOpacity={0} />
          </RadialGradient>
          <Marker id="xtArr" markerWidth={7} markerHeight={7} refX={5.5} refY={3} orient="auto">
            <Path d="M0,0 L6,3 L0,6 Z" fill={color.profit} />
          </Marker>
        </Defs>
        <Rect x={150} y={70} width={200} height={110} fill="url(#xtGlow)" />
        <Path d="M182,48 C214,58 220,88 232,106" fill="none" stroke={color.accent} strokeWidth={1.6} />
        <Path d="M272,116 L346,116" fill="none" stroke={color.accent} strokeWidth={1.6} />
        <Path d="M398,146 C398,214 320,262 292,262" fill="none" stroke={color.profit} strokeWidth={1.8} markerEnd="url(#xtArr)" />
        <Path d="M252,142 L252,190" fill="none" stroke={color.accent} strokeWidth={1.4} strokeDasharray="3 4" opacity={0.55} />
        <G>
          <Rect x={6} y={32} width={176} height={32} rx={8} fill={color.surface2} stroke={color.borderStrong} />
          <SvgText x={16} y={52} fontSize={11} fontFamily={FONT.data} fill={color.ink}>{`${handle} tsla up 5 15m`}</SvgText>
        </G>
        <Polygon points="252,90 280,106 280,138 252,154 224,138 224,106" fill={color.accentWash} stroke={color.accent} strokeWidth={1.4} />
        <SvgText x={252} y={126} textAnchor="middle" fontSize={9.5} fontFamily={FONT.data} fill={color.accent}>agent</SvgText>
        <SvgText x={252} y={172} textAnchor="middle" fontSize={8.5} fontFamily={FONT.data} fill={color.inkMuted}>bounded key · placeFor</SvgText>
        <Rect x={346} y={92} width={88} height={50} rx={10} fill={color.profitWash} stroke={color.profit} strokeOpacity={0.5} />
        <SvgText x={390} y={112} textAnchor="middle" fontSize={10} fontFamily={FONT.data} fill={color.ink}>TSLA · yours</SvgText>
        <SvgText x={390} y={130} textAnchor="middle" fontSize={12} fontFamily={FONT.dataStrong} fill={color.profit}>5.00</SvgText>
        <SvgText x={390} y={160} textAnchor="middle" fontSize={8} fontFamily={FONT.data} fill={color.profit}>unchanged</SvgText>
        <Rect x={212} y={248} width={80} height={28} rx={9} fill={color.surface2} stroke={color.borderStrong} />
        <SvgText x={252} y={266} textAnchor="middle" fontSize={11} fontFamily={FONT.data} fill={color.ink}>you</SvgText>
        <Rect x={150} y={189} width={204} height={32} rx={8} fill={color.lossWash} stroke={color.accent} strokeOpacity={0.5} />
        <SvgText x={183} y={208.5} fontSize={8.5} fontFamily={FONT.data} fill={color.inkSecondary}>withdrawTo() · transfer() · sweepTo()</SvgText>
        <Line x1={183} y1={205} x2={347} y2={205} stroke={color.accent} strokeWidth={1} strokeOpacity={0.6} />
        <SvgText x={252} y={235} textAnchor="middle" fontSize={8.5} fontFamily={FONT.data} fill={color.inkMuted}>no such function for the agent</SvgText>
      </Svg>
      <Text style={[TYPE.caption, styles.cap, { color: color.inkSecondary }]}>
        you mention → the agent opens → <Text style={{ color: color.ink, fontFamily: FONT.bodyStrong }}>the position is yours.</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 10, gap: 6 },
  svg: { aspectRatio: 440 / 300 },
  cap: { textAlign: "center" },
});
