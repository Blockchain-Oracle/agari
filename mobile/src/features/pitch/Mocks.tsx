import { LinearGradient } from "expo-linear-gradient";
import { Lock } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
import { PITCH } from "@/features/pitch/copy";
import { AgariMark } from "~/components/shell/AgariMark";
import { FONT } from "~/theme";
import { PITCH_MOCK as MK, PITCH_PAPER as PP, PITCH_SHADOW } from "~/theme/web/explore/pitch";
import { Rise, Tag } from "./Folio";
import { LogoX } from "./Marks";

/**
 * web pitch/mocks.tsx: the folio's side visuals — each a drawn illustration tagged as one (MOCK · ILLUSTRATIVE,
 * CONCEPT, CONCEPT · NOT LIVE). Under 900 px web centres them under the words, tag above, tilt kept.
 */
const RAW: readonly [number, number][] = [[0, 70], [26, 60], [52, 64], [78, 48], [104, 52], [130, 40], [156, 44], [182, 30], [236, 20]];

export function MiniChart({ w = 236, h = 82, strikeY = 46 }: { w?: number; h?: number; strikeY?: number }) {
  const pts = RAW.map(([x, y]) => [(x / 236) * w, y] as const);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1]}`).join(" ");
  const last = pts[pts.length - 1]!;
  return (
    <Svg width={w} height={h}>
      <Defs>
        <SvgGradient id="pitch-cg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={MK.chartGreen} stopOpacity={0.32} />
          <Stop offset="1" stopColor={MK.chartGreen} stopOpacity={0} />
        </SvgGradient>
      </Defs>
      <Path d={`${d} L${w} ${h} L0 ${h} Z`} fill="url(#pitch-cg)" />
      <Line x1={0} y1={strikeY} x2={w} y2={strikeY} stroke={PP.verm} strokeWidth={1} opacity={0.55} strokeDasharray="3 3" />
      <Path d={d} fill="none" stroke={MK.chartLine} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last[0]} cy={last[1]} r={3.5} fill={MK.chartLine} />
    </Svg>
  );
}

/** A mock centred under the slide's words, its tag above it, tilted as web tilts it. */
function Art({ tag, tilt, i, width, children }: { tag: string; tilt: number; i: number; width: number; children: ReactNode }) {
  return (
    <Rise i={i} style={[styles.art, { width, transform: [{ rotate: `${tilt}deg` }] }]}>
      <Tag>{tag}</Tag>
      {children}
    </Rise>
  );
}

/** A dark phone screen — the Window as it is laid out, or the verdict that stamps it. */
export function PhoneMock({ tilt = 0, won = false, i = 1 }: { tilt?: number; won?: boolean; i?: number }) {
  return (
    <Art tag={PITCH.mock} tilt={tilt} i={i} width={284}>
      <View style={styles.phoneFrame}>
        <View style={styles.phoneScreen}>
          <View style={styles.phoneStatus}>
            <Text style={styles.phoneStatusText}>9:41</Text>
            <Text style={styles.phoneStatusText}>◗ ▮</Text>
          </View>
          <View style={styles.phoneApp}>
            <View style={styles.phoneBrand}>
              <AgariMark width={17} height={17} figure={MK.cream} />
              <Text style={styles.phoneBrandText}>agari</Text>
            </View>
            <Text style={styles.phoneBalance}>12.74 tUSDC</Text>
          </View>
          {won ? (
            <View style={styles.won}>
              <Text style={styles.stamp}>上がり</Text>
              <Text style={styles.wonLabel}>AGARI · IT CAME IN</Text>
              <Text style={styles.wonFigure}>+14.60</Text>
              <Text style={styles.wonSub}>paid to your wallet · settlement receipt ↗</Text>
              <View style={[styles.cta, styles.wonCta]}>
                <Text style={styles.ctaText}>Collect</Text>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.phoneCard}>
                <Text style={styles.phoneQ}>Will TSLA close above $358.20?</Text>
                <View style={styles.phoneChart}>
                  <MiniChart w={236} h={80} />
                </View>
                <View style={styles.phoneMeta}>
                  <Text style={[styles.phoneMetaText, { color: MK.chartLine }]}>TSLA $358.74 ↑</Text>
                  <Text style={styles.phoneMetaText}>closes in 4:12</Text>
                </View>
              </View>
              <View style={styles.sides}>
                <View style={[styles.side, { backgroundColor: MK.upFill, borderColor: MK.upBorder }]}>
                  <Text style={[styles.sideText, { color: MK.chartLine }]}>▲ UP · 64¢</Text>
                </View>
                <View style={[styles.side, { backgroundColor: MK.downFill, borderColor: MK.downBorder }]}>
                  <Text style={[styles.sideText, { color: MK.lock }]}>▼ DOWN · 36¢</Text>
                </View>
              </View>
              <View style={styles.ctaWrap}>
                <View style={styles.cta}>
                  <Text style={styles.ctaText}>Place bet · 5.00 tUSDC</Text>
                </View>
              </View>
            </>
          )}
        </View>
      </View>
    </Art>
  );
}

/** The X post and its reply-to-call — the deferred X rail, drawn as a concept. */
export function XBetCard({ tilt = 0, i = 1 }: { tilt?: number; i?: number }) {
  return (
    <Art tag={PITCH.conceptNotLive} tilt={tilt} i={i} width={336}>
      <View style={styles.xcard}>
        <View style={styles.xBody}>
          <View style={styles.xAuthor}>
            <View style={styles.xAvatar}>
              <AgariMark width={20} height={20} figure={PP.ink} />
            </View>
            <View>
              <Text style={styles.xName}>Agari</Text>
              <Text style={styles.xHandle}>@ — not yet</Text>
            </View>
            <View style={styles.xLogo}>
              <LogoX s={15} fill={MK.xMute} />
            </View>
          </View>
          <Text style={styles.xText}>Will TSLA close above $358.20 at 20:00 UTC?</Text>
          <View style={styles.embed}>
            <View style={styles.embedHead}>
              <Text style={styles.embedText}>AGARI · TSLA $358.20</Text>
              <Text style={[styles.embedText, { color: MK.chartLine }]}>↑ 0.4%</Text>
            </View>
            <MiniChart w={276} h={58} strikeY={34} />
          </View>
        </View>
        <View style={styles.reply}>
          <LinearGradient colors={[MK.replyFrom, MK.replyTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.replyAvatar} />
          <View style={styles.replyBody}>
            <Text style={styles.replyText}>
              <Text style={{ color: MK.xBlue }}>@agari</Text> TSLA up, 5
            </Text>
            <View style={styles.receipt}>
              <View style={styles.receiptDot} />
              <Text style={styles.receiptText}>POSITION OPENED · tx 5n12bZ…</Text>
            </View>
          </View>
        </View>
      </View>
    </Art>
  );
}

/** A custodial app with withdrawals frozen — the problem, as a concept. */
export function FrozenPhone({ tilt = 4, i = 1 }: { tilt?: number; i?: number }) {
  return (
    <Art tag={PITCH.concept} tilt={tilt} i={i} width={258}>
      <View style={styles.frozenFrame}>
        <View style={styles.frozenScreen}>
          <Text style={styles.frozenLabel}>YOUR BALANCE</Text>
          <Text style={styles.frozenBalance}>$1,240.00</Text>
          <View style={styles.banner}>
            <Lock size={17} color={MK.lock} strokeWidth={2} />
            <Text style={styles.bannerText}>Withdrawals disabled</Text>
          </View>
          <View style={styles.frozenBar} />
          <Text style={styles.frozenFoot}>A CUSTODIAL APP</Text>
        </View>
      </View>
    </Art>
  );
}

const mono = FONT.dataRegular;
const styles = StyleSheet.create({
  art: { alignSelf: "center", maxWidth: "100%" },
  phoneFrame: { backgroundColor: MK.phoneFrame, borderRadius: 42, padding: 11, borderWidth: 1, borderColor: MK.phoneBorder, boxShadow: PITCH_SHADOW.phone },
  phoneScreen: { backgroundColor: MK.phoneScreen, borderRadius: 32, overflow: "hidden", paddingBottom: 4 },
  phoneStatus: { flexDirection: "row", justifyContent: "space-between", paddingTop: 13, paddingHorizontal: 22, paddingBottom: 2 },
  phoneStatusText: { color: MK.white55, fontSize: 11, lineHeight: 17, fontFamily: mono },
  phoneApp: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6, paddingHorizontal: 18 },
  phoneBrand: { flexDirection: "row", alignItems: "center", gap: 7 },
  phoneBrandText: { color: MK.cream, fontFamily: FONT.headingHeavy, fontSize: 15 },
  phoneBalance: { color: MK.white50, fontSize: 11, fontFamily: mono },
  phoneCard: { marginVertical: 6, marginHorizontal: 14, backgroundColor: MK.white04, borderRadius: 18, padding: 15 },
  phoneQ: { color: MK.cream, fontSize: 13.5, lineHeight: 17.55, fontFamily: FONT.heading },
  phoneChart: { marginTop: 10 },
  phoneMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  phoneMetaText: { fontSize: 11, fontFamily: mono, color: MK.white50 },
  sides: { flexDirection: "row", gap: 9, paddingVertical: 4, paddingHorizontal: 14 },
  side: { flex: 1, borderRadius: 12, paddingVertical: 11, borderWidth: 1, alignItems: "center" },
  sideText: { fontFamily: mono, fontSize: 12.5 },
  ctaWrap: { paddingTop: 8, paddingHorizontal: 14, paddingBottom: 16 },
  cta: { backgroundColor: PP.verm, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  ctaText: { color: MK.white, fontFamily: FONT.heading, fontSize: 14 },
  won: { paddingTop: 18, paddingHorizontal: 16, paddingBottom: 20, alignItems: "center" },
  stamp: { marginTop: 10, fontFamily: FONT.stamp, fontSize: 40, lineHeight: 52, color: PP.verm, transform: [{ rotate: "-4deg" }] },
  wonLabel: { color: MK.chartLine, fontSize: 12, fontFamily: mono, letterSpacing: 1.44, marginTop: 14 },
  wonFigure: { color: MK.cream, fontSize: 40, lineHeight: 48, fontFamily: FONT.headingHeavy, letterSpacing: -1.2, marginTop: 4 },
  wonSub: { color: MK.white45, fontSize: 11, fontFamily: mono, marginTop: 6, textAlign: "center" },
  wonCta: { alignSelf: "stretch", marginTop: 18 },
  xcard: { backgroundColor: MK.xBg, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: MK.xBorder, boxShadow: PITCH_SHADOW.xcard },
  xBody: { paddingTop: 16, paddingHorizontal: 18, paddingBottom: 14 },
  xAuthor: { flexDirection: "row", gap: 10, alignItems: "center" },
  xAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: MK.cream, alignItems: "center", justifyContent: "center" },
  xName: { fontFamily: FONT.heading, fontSize: 14, color: MK.xInk },
  xHandle: { color: MK.xMute, fontSize: 12, fontFamily: mono },
  xLogo: { marginLeft: "auto" },
  xText: { marginTop: 11, fontSize: 14.5, lineHeight: 19.6, fontFamily: FONT.heading, color: MK.xInk },
  embed: { marginTop: 11, backgroundColor: MK.phoneScreen, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: MK.phoneBorder },
  embedHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  embedText: { color: MK.cream, fontSize: 11.5, fontFamily: mono },
  reply: { borderTopWidth: 1, borderTopColor: MK.xBorder, paddingVertical: 14, paddingHorizontal: 18, flexDirection: "row", gap: 11 },
  replyAvatar: { width: 32, height: 32, borderRadius: 16 },
  replyBody: { flexShrink: 1, alignItems: "flex-start" },
  replyText: { fontSize: 13.5, fontFamily: FONT.heading, color: MK.xInk },
  receipt: { marginTop: 9, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: MK.receiptFill, borderWidth: 1, borderColor: MK.receiptBorder, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  receiptDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: MK.chartLine },
  receiptText: { fontSize: 11.5, fontFamily: mono, color: MK.chartLine },
  frozenFrame: { backgroundColor: MK.frozenFrame, borderRadius: 38, padding: 10, boxShadow: PITCH_SHADOW.frozen },
  frozenScreen: { backgroundColor: MK.frozenScreen, borderRadius: 30, paddingVertical: 24, paddingHorizontal: 20, minHeight: 372 },
  frozenLabel: { color: MK.white40, fontSize: 11, fontFamily: mono, letterSpacing: 1.1 },
  frozenBalance: { color: MK.white82, fontSize: 34, lineHeight: 42, fontFamily: FONT.headingHeavy, letterSpacing: -0.68, marginTop: 5 },
  banner: { marginTop: 26, backgroundColor: MK.downFill, borderWidth: 1, borderColor: MK.downBorder, borderRadius: 12, padding: 15, flexDirection: "row", alignItems: "center", gap: 11 },
  bannerText: { color: MK.lock, fontSize: 12.5, fontFamily: mono },
  frozenBar: { marginTop: 14, height: 40, borderRadius: 10, backgroundColor: MK.white05 },
  frozenFoot: { marginTop: "auto", color: MK.white28, fontSize: 10, fontFamily: mono, textAlign: "center", letterSpacing: 1 },
});
