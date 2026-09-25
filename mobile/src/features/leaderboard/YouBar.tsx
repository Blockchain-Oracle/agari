import { formatBaseUnits } from "@agari/core/units";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { glyphFromAddress } from "@/features/leaderboard/glyph";
import type { BoardData } from "@/features/leaderboard/protocol";
import { FONT, useTheme } from "~/theme";
import { leaderboardTokens } from "~/theme/web/explore/leaderboard";
import { BOARD_PHONE } from "./words";

/** The slim bar's height, so the page can keep its last row clear of it. */
export const YOU_BAR_H = 52;

/**
 * web's vermilion `.you-bar` slimmed for a phone: your glyph, rank (or Unranked) of the ranked field, your net and
 * the cream "Your ledger →" pill, docked just above the floating dock.
 */
export function YouBar({ address, data }: { address: string; data: BoardData }) {
  const { name, color } = useTheme();
  const t = leaderboardTokens(name);
  const words = BOARD_PHONE.you;
  // Exact match: base58 is case-sensitive (D-010).
  const index = data.rankings.findIndex((r) => r.owner === address);
  const trader = index === -1 ? null : data.rankings[index];
  const ranked = data.meta.rankedTraders;
  const net = trader ? `${trader.pnlBase >= 0n ? "+" : ""}${formatBaseUnits(trader.pnlBase, data.meta.decimals)}` : "—";
  return (
    <View style={[styles.bar, { backgroundColor: color.accent, shadowColor: t.youShadow }]}>
      <View style={[styles.portrait, { backgroundColor: t.youPortraitFill, borderColor: t.youPortraitBorder }]}>
        <Text style={[styles.glyph, { color: t.youPortraitInk }]}>{glyphFromAddress(address)}</Text>
      </View>
      <Text style={styles.rankLine} numberOfLines={1}>
        <Text style={[styles.rank, { color: t.youInk }]}>{trader ? `#${index + 1}` : words.unranked}</Text>
        <Text style={[styles.soft, { color: t.youSoft }]}> {words.of(ranked > 0 ? ranked.toLocaleString() : "—")}</Text>
      </Text>
      <View style={styles.net}>
        <Text style={[styles.lbl, { color: t.youSoft }]}>{words.net}</Text>
        <Text style={[styles.netValue, { color: t.youInk }]} numberOfLines={1}>
          {net}
        </Text>
      </View>
      <Pressable onPress={() => router.push("/portfolio")} accessibilityRole="link" style={[styles.cta, { backgroundColor: t.youCtaFill }]}>
        <Text style={[styles.ctaText, { color: color.accent }]}>{words.ledger}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: YOU_BAR_H, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, borderRadius: 999, shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  portrait: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  glyph: { fontFamily: FONT.heading, fontSize: 13 },
  rankLine: { flexShrink: 1 },
  rank: { fontFamily: FONT.headingHeavy, fontSize: 18, letterSpacing: -0.54, fontVariant: ["tabular-nums"] },
  soft: { fontFamily: FONT.body, fontSize: 12 },
  net: { flex: 1, alignItems: "flex-end" },
  lbl: { fontFamily: FONT.dataRegular, fontSize: 8, lineHeight: 11, letterSpacing: 1.3, textTransform: "uppercase" },
  netValue: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 18, fontVariant: ["tabular-nums"] },
  cta: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999 },
  ctaText: { fontFamily: FONT.bodyBold, fontSize: 11.5, lineHeight: 15, letterSpacing: 0.46 },
});
