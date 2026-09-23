import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";
import { PITCH } from "@/features/pitch/copy";
import { Image } from "expo-image";
import { BRAND_LOGOS } from "~/components/logos/brand-logos";
import { AgariMark } from "~/components/shell/AgariMark";
import { FONT, RADIUS, TYPE } from "~/theme";
import { DARK } from "~/theme/palette";
import { PAPER, Rise, Tag } from "./Folio";

/**
 * web pitch/mocks.tsx: the folio's side visuals, redrawn natively. Every one is an illustration, not product state,
 * and carries web's own tag saying so (MOCK · ILLUSTRATIVE, CONCEPT, CONCEPT · NOT LIVE). The phone screen is the
 * product's dark ground in both themes, as on web.
 */
const SCREEN = DARK;

/** web's raw chart points, scaled to the requested width. */
const RAW: readonly [number, number][] = [[0, 70], [26, 60], [52, 64], [78, 48], [104, 52], [130, 40], [156, 44], [182, 30], [236, 20]];

export function MiniChart({ w = 236, h = 82, strikeY = 46 }: { w?: number; h?: number; strikeY?: number }) {
  const pts = RAW.map(([x, y]) => [(x / 236) * w, y] as const);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1]}`).join(" ");
  const last = pts[pts.length - 1]!;
  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id="pitch-cg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={SCREEN.profit} stopOpacity={0.3} />
          <Stop offset="1" stopColor={SCREEN.profit} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={`${d} L${w} ${h} L0 ${h} Z`} fill="url(#pitch-cg)" />
      <Line x1={0} y1={strikeY} x2={w} y2={strikeY} stroke={SCREEN.inkMuted} strokeDasharray="3 3" />
      <Path d={d} fill="none" stroke={SCREEN.profit} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last[0]} cy={last[1]} r={3.5} fill={SCREEN.profit} />
    </Svg>
  );
}

/** A dark phone screen: the Window as it is laid out, or the verdict that stamps it (web `PhoneMock`). */
export function PhoneMock({ won = false, i = 3 }: { won?: boolean; i?: number }) {
  return (
    <Rise i={i}>
      <View style={styles.mockWrap}>
        <Tag>{PITCH.mock}</Tag>
        <View style={[styles.phone, { backgroundColor: SCREEN.ground, borderColor: PAPER.ink }]}>
          <View style={styles.phoneTop}>
            <View style={styles.row}>
              <AgariMark width={12} height={12} figure={SCREEN.ink} />
              <Text style={[styles.phoneBrand, { color: SCREEN.ink }]}>agari</Text>
            </View>
            <Text style={[styles.mono, { color: SCREEN.inkSecondary }]}>12.74 tUSDC</Text>
          </View>
          {won ? (
            <View style={styles.won}>
              <Text style={[TYPE.stamp, { color: SCREEN.accent }]}>上がり</Text>
              <Text style={[styles.mono, { color: SCREEN.inkSecondary }]}>AGARI · IT CAME IN</Text>
              <Text style={[TYPE.dataHero, { color: SCREEN.profit }]}>+14.60</Text>
              <Text style={[styles.mono, { color: SCREEN.inkMuted }]}>paid to your wallet · settlement receipt</Text>
              <View style={[styles.cta, { backgroundColor: SCREEN.accent }]}>
                <Text style={[styles.ctaText, { color: SCREEN.onAccent }]}>Collect</Text>
              </View>
            </View>
          ) : (
            <>
              <View style={[styles.card, { backgroundColor: SCREEN.surface1, borderColor: SCREEN.hairline }]}>
                <Text style={[TYPE.bodyStrong, { color: SCREEN.ink }]}>Will TSLA close above $358.20?</Text>
                <MiniChart w={220} h={70} strikeY={40} />
                <View style={styles.between}>
                  <Text style={[styles.mono, { color: SCREEN.profit }]}>TSLA $358.74</Text>
                  <Text style={[styles.mono, { color: SCREEN.inkMuted }]}>closes in 4:12</Text>
                </View>
              </View>
              <View style={styles.sides}>
                <View style={[styles.side, { backgroundColor: SCREEN.profitWash }]}>
                  <Text style={[styles.mono, { color: SCREEN.profit }]}>UP · 64¢</Text>
                </View>
                <View style={[styles.side, { backgroundColor: SCREEN.lossWash }]}>
                  <Text style={[styles.mono, { color: SCREEN.loss }]}>DOWN · 36¢</Text>
                </View>
              </View>
              <View style={[styles.cta, { backgroundColor: SCREEN.accent }]}>
                <Text style={[styles.ctaText, { color: SCREEN.onAccent }]}>Place bet · 5.00 tUSDC</Text>
              </View>
            </>
          )}
        </View>
      </View>
    </Rise>
  );
}

/** The X post + reply-to-call card — the deferred X rail, drawn as a concept (web `XBetCard`). */
export function XBetCard({ i = 4 }: { i?: number }) {
  return (
    <Rise i={i}>
      <View style={styles.mockWrap}>
        <Tag>{PITCH.conceptNotLive}</Tag>
        <View style={[styles.xcard, { backgroundColor: PAPER.surface3, borderColor: PAPER.creamHairline }]}>
          <View style={styles.between}>
            <View style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: PAPER.ink }]}>
                <AgariMark width={13} height={13} figure={PAPER.cream} />
              </View>
              <View>
                <Text style={[TYPE.bodyStrong, { color: PAPER.ink }]}>Agari</Text>
                <Text style={[styles.mono, { color: PAPER.inkMuted }]}>@ — not yet</Text>
              </View>
            </View>
            {/* The sheet is paper in both themes, so the mark is always the one that reads on light. */}
            <Image source={BRAND_LOGOS.x.light} style={styles.xmark} contentFit="contain" accessible={false} />
          </View>
          <Text style={[TYPE.body, { color: PAPER.ink }]}>Will TSLA close above $358.20 at 20:00 UTC?</Text>
          <View style={[styles.embed, { backgroundColor: SCREEN.ground }]}>
            <View style={styles.between}>
              <Text style={[styles.mono, { color: SCREEN.inkSecondary }]}>AGARI · TSLA $358.20</Text>
              <Text style={[styles.mono, { color: SCREEN.profit }]}>+0.4%</Text>
            </View>
            <MiniChart w={240} h={54} strikeY={32} />
          </View>
          <View style={[styles.reply, { borderTopColor: PAPER.creamHairline }]}>
            <Text style={[TYPE.caption, { color: PAPER.ink }]}>
              <Text style={{ color: PAPER.accent }}>@agari</Text> TSLA up, 5
            </Text>
            <Text style={[styles.mono, { color: PAPER.profit }]}>POSITION OPENED · tx 5n12bZ…</Text>
          </View>
        </View>
      </View>
    </Rise>
  );
}

/** A custodial app with withdrawals frozen — the problem, as a concept (web `FrozenPhone`). */
export function FrozenPhone({ i = 3 }: { i?: number }) {
  return (
    <Rise i={i}>
      <View style={styles.mockWrap}>
        <Tag>{PITCH.concept}</Tag>
        <View style={[styles.phone, styles.frozen, { backgroundColor: SCREEN.surface1, borderColor: PAPER.ink }]}>
          <Text style={[styles.mono, { color: SCREEN.inkMuted }]}>YOUR BALANCE</Text>
          <Text style={[TYPE.dataHero, { color: SCREEN.inkDisabled }]}>$1,240.00</Text>
          <View style={[styles.banner, { backgroundColor: SCREEN.lossWash }]}>
            <SymbolView name={{ ios: "lock.fill", android: "lock" }} size={15} tintColor={SCREEN.loss} />
            <Text style={[TYPE.bodyStrong, { color: SCREEN.loss }]}>Withdrawals disabled</Text>
          </View>
          <Text style={[styles.mono, { color: SCREEN.inkMuted }]}>A CUSTODIAL APP</Text>
        </View>
      </View>
    </Rise>
  );
}

const styles = StyleSheet.create({
  mockWrap: { gap: 8, alignItems: "center" },
  phone: { width: 260, borderRadius: 30, borderWidth: 5, padding: 14, gap: 12 },
  phoneTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  phoneBrand: { fontFamily: FONT.heading, fontSize: 13 },
  mono: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 0.8 },
  card: { borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth, padding: 10, gap: 8, overflow: "hidden" },
  sides: { flexDirection: "row", gap: 8 },
  side: { flex: 1, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: "center" },
  cta: { borderRadius: RADIUS.full, paddingVertical: 11, alignItems: "center" },
  ctaText: { fontFamily: FONT.bodyStrong, fontSize: 13 },
  won: { alignItems: "center", gap: 8, paddingVertical: 12 },
  xcard: { width: "100%", borderRadius: RADIUS.lg, borderWidth: 1, padding: 14, gap: 10 },
  xmark: { width: 15, height: 15 },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  embed: { borderRadius: RADIUS.md, padding: 10, gap: 6, overflow: "hidden" },
  reply: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 4 },
  frozen: { alignItems: "center", paddingVertical: 28 },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8 },
});
