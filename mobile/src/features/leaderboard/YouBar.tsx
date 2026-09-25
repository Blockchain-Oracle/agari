import { shortHex } from "@agari/core/units";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LEADERBOARD, type BoardSpan } from "@/features/leaderboard/copy";
import { glyphFromAddress } from "@/features/leaderboard/glyph";
import type { BoardData } from "@/features/leaderboard/protocol";
import { FONT, useTheme } from "~/theme";
import { leaderboardTokens } from "~/theme/web/explore/leaderboard";

/**
 * web's sticky vermilion `YouBar` (features/leaderboard/YouBar.tsx, part-09 `.you-bar`, part-14 ≤1100 px): your rank
 * and "of N on the venue", your glyph, name and standing in two columns, the stats hidden as web hides them on a phone,
 * and the cream "Your ledger →" pill under the rank.
 */
export function YouBar({ address, data, span }: { address: string; data: BoardData; span: BoardSpan }) {
  const { name, color } = useTheme();
  const t = leaderboardTokens(name);
  const words = LEADERBOARD.you;
  // Exact match: base58 is case-sensitive (D-010).
  const index = data.rankings.findIndex((r) => r.owner === address);
  const ranked = data.meta.rankedTraders;
  const rankedText = ranked > 0 ? ranked.toLocaleString() : LEADERBOARD.dash;
  const standing = index === -1 ? words.none(span) : words.top(Math.round(((index + 1) / Math.max(1, ranked)) * 100));
  return (
    <View style={[styles.bar, { backgroundColor: color.accent, shadowColor: t.youShadow }]}>
      <View style={styles.grid}>
        <View style={styles.col}>
          <Text style={[styles.lbl, { color: t.youSoft }]}>{words.rank}</Text>
          <Text>
            <Text style={[styles.val, { color: t.youInk }]}>{index === -1 ? words.unranked : `#${index + 1}`}</Text>
            <Text style={[styles.of, { color: t.youSoft }]}> {words.of(rankedText)}</Text>
          </Text>
        </View>
        <View style={[styles.col, styles.info]}>
          <View style={[styles.portrait, { backgroundColor: t.youPortraitFill, borderColor: t.youPortraitBorder }]}>
            <Text style={[styles.glyph, { color: t.youPortraitInk }]}>{glyphFromAddress(address)}</Text>
          </View>
          <View style={styles.text}>
            <Text style={[styles.name, { color: t.youInk }]} numberOfLines={1}>
              {words.name(shortHex(address))}
            </Text>
            <Text style={[styles.meta, { color: t.youInk }]}>{standing}</Text>
          </View>
        </View>
      </View>
      <View style={styles.grid}>
        <Pressable onPress={() => router.push("/portfolio")} accessibilityRole="link" style={[styles.col, styles.cta, { backgroundColor: t.youCtaFill }]}>
          <Text style={[styles.ctaText, { color: color.accent }]}>{words.cta}</Text>
        </Pressable>
        <View style={styles.col} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderRadius: 4, paddingVertical: 16, paddingHorizontal: 24, gap: 12, shadowOpacity: 1, shadowRadius: 30, shadowOffset: { width: 0, height: 18 }, elevation: 12 },
  grid: { flexDirection: "row", alignItems: "center", gap: 12 },
  col: { flex: 1, minWidth: 0 },
  lbl: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.98, textTransform: "uppercase", marginBottom: 2 },
  val: { fontFamily: FONT.headingHeavy, fontSize: 28, lineHeight: 28, letterSpacing: -0.84, fontVariant: ["tabular-nums"] },
  of: { fontFamily: FONT.body, fontSize: 14 },
  info: { flexDirection: "row", alignItems: "center", gap: 16 },
  portrait: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  glyph: { fontFamily: FONT.heading, fontSize: 17, letterSpacing: 0.34 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: FONT.heading, fontSize: 15, lineHeight: 24 },
  meta: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 0.6, opacity: 0.8 },
  cta: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
  ctaText: { fontFamily: FONT.bodyStrong, fontSize: 12, lineHeight: 19.2, letterSpacing: 0.48 },
});
