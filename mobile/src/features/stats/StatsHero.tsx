import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { STATS } from "@/features/stats/copy";
import { CONTAINER_GUTTER } from "~/features/explore/ExplorePage";
import { FONT, useTheme } from "~/theme";
import { statsTokens } from "~/theme/web/explore/stats";
import { PulseDot } from "./PulseDot";

/** The four part-04 `.crop` marks, 18 px corners at 24 px in; the top pair sits 96 px into the hero, under the chrome's 29. */
function Crops({ tone }: { tone: string }) {
  return (
    <>
      <View style={[styles.crop, { top: 67, left: 24, borderTopWidth: 1, borderLeftWidth: 1, borderColor: tone }]} />
      <View style={[styles.crop, { top: 67, right: 24, borderTopWidth: 1, borderRightWidth: 1, borderColor: tone }]} />
      <View style={[styles.crop, { bottom: 24, left: 24, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: tone }]} />
      <View style={[styles.crop, { bottom: 24, right: 24, borderBottomWidth: 1, borderRightWidth: 1, borderColor: tone }]} />
    </>
  );
}

/**
 * web's `.page-hero.stats-hero` (features/stats/StatsPage.tsx) on a phone: the eyebrow (dash, pulsing dot, words),
 * "Proof of / demand.", the lede, then the emerald headline card — wallets that called in 24 h over the calls filled.
 * Full-bleed with the page rule under it, as web's hero spans the viewport.
 */
export function StatsHero({ wallets, calls }: { wallets: string; calls: string }) {
  const { name, color } = useTheme();
  const t = statsTokens(name);
  const words = STATS.hero;
  return (
    <View style={[styles.hero, { borderBottomColor: t.pageRule }]}>
      <Crops tone={t.crop} />
      <View style={styles.eyebrow}>
        <View style={[styles.dash, { backgroundColor: t.dash }]} />
        <PulseDot />
        <Text style={[styles.eyebrowText, { color: color.inkMuted }]}>{words.eyebrow}</Text>
      </View>
      <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
        {words.titleLead}
        {"\n"}
        <Text style={{ color: color.accent }}>{words.titleAccent}</Text>.
      </Text>
      <Text style={[styles.lede, { color: color.inkSecondary }]}>{words.lede}</Text>

      <LinearGradient colors={[t.profitFill7, t.profitClear]} style={[styles.headline, { borderColor: t.profitBorder }]}>
        <View style={styles.headEyebrow}>
          <View style={[styles.headDot, { backgroundColor: color.profit, shadowColor: color.profit }]} />
          <Text style={[styles.headEyebrowText, { color: color.inkMuted }]}>{words.headline}</Text>
        </View>
        <Text style={[styles.value, { color: color.profit, textShadowColor: t.profitGlow }]} accessibilityLabel={`${words.headline}: ${wallets}`}>
          {wallets}
        </Text>
        <Text style={[styles.caption, { color: t.profitInk80 }]}>{words.headlineCaption}</Text>
        <View style={[styles.foot, { borderTopColor: t.hairline }]}>
          <Text style={[styles.footLabel, { color: color.inkDisabled }]}>{words.headlineFoot}</Text>
          <Text style={[styles.footValue, { color: color.ink }]}>{calls}</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  // web: .stats padding-top 64 + .page-hero 116 → the eyebrow sits 87 below the chrome; 24 under, the hero rule.
  hero: { marginHorizontal: -CONTAINER_GUTTER, paddingHorizontal: CONTAINER_GUTTER, paddingTop: 87, paddingBottom: 24, borderBottomWidth: 1, overflow: "hidden" },
  crop: { position: "absolute", width: 18, height: 18 },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  dash: { width: 18, height: 1 },
  eyebrowText: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.32, textTransform: "uppercase" },
  title: { fontFamily: FONT.headingHeavy, fontSize: 45, lineHeight: 42.3, letterSpacing: -2.25, paddingTop: 2 },
  lede: { fontFamily: FONT.body, fontSize: 15, lineHeight: 24.375, marginTop: 24 },
  headline: { marginTop: 20, borderWidth: 1, borderRadius: 16, padding: 28 },
  headEyebrow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  headDot: { width: 6, height: 6, borderRadius: 3, shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
  headEyebrowText: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 2.2, textTransform: "uppercase", flexShrink: 1 },
  value: { fontFamily: FONT.headingHeavy, fontSize: 64, lineHeight: 64, letterSpacing: -3.2, fontVariant: ["tabular-nums"], textShadowRadius: 20, textShadowOffset: { width: 0, height: 0 } },
  caption: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, marginTop: 8, marginBottom: 20 },
  foot: { borderTopWidth: 1, paddingTop: 16 },
  footLabel: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.44, textTransform: "uppercase" },
  footValue: { fontFamily: FONT.dataStrong, fontSize: 18, lineHeight: 28.8, fontVariant: ["tabular-nums"] },
});
