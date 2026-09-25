import type { Badge } from "@agari/core/projection";
import { BadgeCheck, ChartNoAxesCombined, Crown, Droplets, Flame, Target, type LucideIcon } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { HISTORY } from "@/features/markets/history/copy";
import { usePortfolioTokens } from "~/components/portfolio/web";
import { FONT, useTheme } from "~/theme";
import { WEB_TYPE } from "~/theme/web/portfolio";

const ICONS: Record<Badge["id"], LucideIcon> = {
  first_trade: Target,
  winning_streak: Flame,
  lp_provider: Droplets,
  whale: ChartNoAxesCombined,
  oracle: Crown,
};

/**
 * web `BadgeGrid` (history.css `.badge-*`, one column on a phone): the season-rank cell over the ground, then one
 * numbered card per badge — earned on the vermilion wash, locked faded — each saying Unlocked or Locked in words.
 */
export function BadgeGrid({ badges }: { badges: readonly Badge[] }) {
  const { color } = useTheme();
  const t = usePortfolioTokens();
  const earned = badges.filter((b) => b.earned).length;
  const total = badges.length;
  const progress = total > 0 ? Math.round((earned / total) * 100) : 0;
  const next = badges.find((b) => !b.earned && b.pending === null);

  return (
    <View style={[styles.display, { borderColor: color.hairline, backgroundColor: color.ground }]}>
      <View style={[styles.rank, { borderBottomColor: color.hairline, backgroundColor: t.badgeRankFill }]}>
        <View>
          <Text style={[WEB_TYPE.labelMicro, { color: color.inkMuted }]}>{HISTORY.reputation.seasonRank}</Text>
          <Text style={[styles.figure, { color: color.ink }]}>
            {earned}
            <Text style={[styles.slash, { color: color.inkMuted }]}>/</Text>
            {total}
          </Text>
          <Text style={[WEB_TYPE.caption, { color: color.inkSecondary }]}>{next ? HISTORY.reputation.next(HISTORY.badges.names[next.id].name) : HISTORY.reputation.unlocked(earned, total)}</Text>
        </View>
        <View style={[styles.bar, { backgroundColor: t.repBar }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: progress }}>
          <View style={[styles.fill, { width: `${progress}%`, backgroundColor: t.vermilion }]} />
        </View>
      </View>
      <View style={styles.grid}>
        {badges.map((badge, index) => {
          const Icon = ICONS[badge.id] ?? BadgeCheck;
          const words = HISTORY.badges.names[badge.id];
          const on = badge.earned;
          return (
            <View
              key={badge.id}
              style={[
                styles.card,
                on ? { borderColor: t.slabBorder, backgroundColor: t.earnedWash } : { borderColor: color.hairline, backgroundColor: t.badgeLocked, opacity: t.badgeLockedOpacity },
              ]}
              accessibilityLabel={`${words.name}. ${words.description}`}
            >
              <View style={styles.head}>
                <Text style={[WEB_TYPE.labelMicro, { color: on ? t.vermilion : color.inkMuted }]}>{String(index + 1).padStart(2, "0")}</Text>
                <Text style={[WEB_TYPE.labelMicro, { color: on ? t.vermilion : color.inkMuted }]}>
                  {on ? HISTORY.badges.unlocked : badge.pending === "earn" ? HISTORY.badges.pendingEarn : HISTORY.badges.locked}
                </Text>
              </View>
              <View style={[styles.icon, on ? { borderColor: t.earnedIconBorder, backgroundColor: t.earnedIconWash } : { borderColor: color.hairline }]}>
                <Icon size={16} strokeWidth={1.9} color={on ? t.vermilion : color.inkMuted} />
              </View>
              <Text style={[WEB_TYPE.bodyStrong, { color: color.ink }]}>{words.name}</Text>
              <Text style={[WEB_TYPE.caption, { color: color.inkSecondary }]}>{words.description}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  display: { overflow: "hidden", borderWidth: 1, borderRadius: 12 },
  rank: { justifyContent: "space-between", gap: 20, minHeight: 128, padding: 20, borderBottomWidth: 1 },
  figure: { marginTop: 8, fontFamily: FONT.headingHeavy, fontSize: 48, lineHeight: 50 },
  slash: { fontSize: 20 },
  bar: { height: 6, overflow: "hidden", borderRadius: 999 },
  fill: { height: "100%", minWidth: 6, borderRadius: 999 },
  grid: { gap: 12, padding: 12 },
  card: { minHeight: 144, padding: 16, borderWidth: 1, borderRadius: 8 },
  head: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 20 },
  icon: { width: 36, height: 36, marginBottom: 12, borderWidth: 1, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
