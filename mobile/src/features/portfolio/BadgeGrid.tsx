import type { Badge } from "@agari/core/projection";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";
import { HISTORY } from "@/features/markets/history/copy";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

/** web `BadgeGrid`'s lucide icons, as SF Symbols / Material Symbols. */
const ICONS: Record<Badge["id"], SymbolViewProps["name"]> = {
  first_trade: { ios: "target", android: "target" },
  winning_streak: { ios: "flame.fill", android: "local_fire_department" },
  lp_provider: { ios: "drop.fill", android: "water_drop" },
  whale: { ios: "chart.bar.fill", android: "bar_chart" },
  oracle: { ios: "crown.fill", android: "workspace_premium" },
};

/**
 * web `BadgeGrid` (the reference's `BadgeDisplay`): a season-rank cell, then one card per badge, numbered, each saying
 * Unlocked or Locked in words — a badge whose source is not connected yet names the capability it waits on.
 */
export function BadgeGrid({ badges }: { badges: readonly Badge[] }) {
  const { color } = useTheme();
  const earned = badges.filter((b) => b.earned).length;
  const total = badges.length;
  const progress = total > 0 ? Math.round((earned / total) * 100) : 0;
  const next = badges.find((b) => !b.earned && b.pending === null);

  return (
    <View style={styles.wrap}>
      <View style={[styles.rank, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{HISTORY.reputation.seasonRank}</Text>
        <Text style={[styles.figure, { color: color.ink }]}>
          {earned}
          <Text style={{ color: color.inkMuted }}>/</Text>
          {total}
        </Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{next ? HISTORY.reputation.next(HISTORY.badges.names[next.id].name) : HISTORY.reputation.unlocked(earned, total)}</Text>
        <View style={[styles.bar, { backgroundColor: color.surface2 }]} accessibilityRole="progressbar" accessibilityLabel={HISTORY.reputation.unlocked(earned, total)} accessibilityValue={{ min: 0, max: 100, now: progress }}>
          <View style={{ width: `${progress}%`, height: "100%", backgroundColor: color.accent }} />
        </View>
      </View>
      <View style={styles.grid}>
        {badges.map((badge, i) => {
          const words = HISTORY.badges.names[badge.id];
          const state = badge.earned ? HISTORY.badges.unlocked : badge.pending === "earn" ? HISTORY.badges.pendingEarn : HISTORY.badges.locked;
          return (
            <View key={badge.id} style={styles.cell}>
              <View
                style={[styles.card, { backgroundColor: badge.earned ? color.accentWash : color.surface1, borderColor: badge.earned ? color.accentDim : color.hairline, opacity: badge.earned ? 1 : 0.72 }]}
                accessible
                accessibilityLabel={`${words.name}, ${state}. ${words.description}`}
              >
                <View style={styles.head}>
                  <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{String(i + 1).padStart(2, "0")}</Text>
                  <Text style={[TYPE.labelMicro, { color: badge.earned ? color.accent : color.inkMuted, flexShrink: 1, textAlign: "right" }]} numberOfLines={2}>
                    {state}
                  </Text>
                </View>
                <SymbolView name={ICONS[badge.id]} size={22} tintColor={badge.earned ? color.accent : color.inkMuted} />
                <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{words.name}</Text>
                <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{words.description}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  rank: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 4 },
  figure: { fontFamily: FONT.dataStrong, fontSize: 32, lineHeight: 36 },
  bar: { height: 6, borderRadius: RADIUS.full, overflow: "hidden", marginTop: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 },
  cell: { width: "50%", padding: 5 },
  card: { flex: 1, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 6 },
  head: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
});
