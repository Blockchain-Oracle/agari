import { shortHex } from "@agari/core/units";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LEADERBOARD, type BoardSpan } from "@/features/leaderboard/copy";
import type { BoardData } from "@/features/leaderboard/protocol";
import { haptic } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { signedPnl } from "./board";
import { Portrait } from "./Portrait";

function Stat({ label, value }: { label: string; value: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.label, { color: color.onAccent }]}>{label}</Text>
      <Text style={[styles.value, { color: color.onAccent }]}>{value}</Text>
    </View>
  );
}

/**
 * web's sticky vermilion `YouBar` (features/leaderboard/YouBar.tsx): the connected wallet's rank, or Unranked, with its
 * net, win rate and streak, pinned above the tab bar. The bar opens Portfolio, web's "Your ledger →".
 */
export function YouBar({ address, data, span }: { address: string; data: BoardData; span: BoardSpan }) {
  const { color } = useTheme();
  const words = LEADERBOARD.you;
  const dash = LEADERBOARD.dash;
  // Exact match: base58 is case-sensitive (D-010).
  const index = data.rankings.findIndex((r) => r.owner === address);
  const trader = index === -1 ? null : data.rankings[index];
  const ranked = data.meta.rankedTraders;
  const rankedText = ranked > 0 ? ranked.toLocaleString() : dash;
  const standing = trader ? words.top(Math.round(((index + 1) / Math.max(1, ranked)) * 100)) : words.none(span);
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        router.push("/portfolio");
      }}
      accessibilityRole="button"
      accessibilityLabel={`${words.rank}: ${trader ? `#${index + 1}` : words.unranked} ${words.of(rankedText)}. ${standing}. ${words.cta}`}
      style={({ pressed }) => [styles.bar, { backgroundColor: pressed ? color.accentPressed : color.accent, shadowColor: color.shadow }]}
    >
      <View style={styles.top}>
        <View style={styles.rankBlock}>
          <Text style={[styles.label, { color: color.onAccent }]}>{words.rank}</Text>
          <Text style={[styles.rank, { color: color.onAccent }]}>{trader ? `#${index + 1}` : words.unranked}</Text>
        </View>
        <Portrait address={address} size={34} ring={color.onAccent} />
        <View style={styles.who}>
          <Text style={[TYPE.bodyStrong, { color: color.onAccent }]} numberOfLines={1}>
            {words.name(shortHex(address))}
          </Text>
          <Text style={[TYPE.caption, { color: color.onAccent }]} numberOfLines={2}>
            {words.of(rankedText)} · {standing}
          </Text>
        </View>
      </View>
      <View style={[styles.stats, { borderTopColor: color.onAccent }]}>
        <Stat label={words.net} value={trader ? signedPnl(trader.pnlBase, data.meta.decimals) : dash} />
        <Stat label={words.winRate} value={trader ? `${trader.winRatePct}%` : dash} />
        <Stat label={words.streak} value={trader ? String(trader.bestStreak).padStart(2, "0") : dash} />
        <Text style={[TYPE.bodyStrong, styles.cta, { color: color.onAccent }]}>{words.cta}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderRadius: RADIUS.lg,
    padding: 12,
    gap: 10,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  rankBlock: { minWidth: 70 },
  rank: { fontFamily: FONT.dataStrong, fontSize: 22, lineHeight: 26 },
  who: { flex: 1 },
  stats: { flexDirection: "row", alignItems: "flex-end", gap: 16, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  stat: { gap: 2 },
  label: { fontFamily: FONT.data, fontSize: 9.5, letterSpacing: 1.2, textTransform: "uppercase", opacity: 0.85 },
  value: { fontFamily: FONT.dataStrong, fontSize: 14 },
  cta: { marginLeft: "auto" },
});
