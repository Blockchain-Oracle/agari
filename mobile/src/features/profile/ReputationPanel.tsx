import type { Badge, ReputationData } from "@agari/core/projection";
import { BadgeCheck, ChartNoAxesCombined, Crown, Droplets, Flame, Target, type LucideIcon } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { HISTORY } from "@/features/markets/history/copy";
import { FONT, useTheme } from "~/theme";
import { profileTokens } from "~/theme/web/explore/profile";

const ICONS: Record<Badge["id"], LucideIcon> = {
  first_trade: Target,
  winning_streak: Flame,
  lp_provider: Droplets,
  whale: ChartNoAxesCombined,
  oracle: Crown,
};

/** `.reputation-bar` / `.badge-rank-bar`: the 6 px track and its vermilion fill (never narrower than 6 px). */
function Bar({ pct, label }: { pct: number; label: string }) {
  const { name, color } = useTheme();
  const t = profileTokens(name);
  return (
    <View style={[styles.bar, { backgroundColor: t.track }]} accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: pct }}>
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color.accent }]} />
    </View>
  );
}

/** web's BadgeGrid (the reference's BadgeDisplay) on a phone: the season-rank cell, then one card per badge, stacked. */
function BadgeGrid({ badges }: { badges: readonly Badge[] }) {
  const { name, color } = useTheme();
  const t = profileTokens(name);
  const earned = badges.filter((b) => b.earned).length;
  const total = badges.length;
  const progress = total > 0 ? Math.round((earned / total) * 100) : 0;
  const next = badges.find((b) => !b.earned && b.pending === null);
  return (
    <View style={[styles.display, { backgroundColor: t.badgeGround, borderColor: t.plateBorder }]}>
      <View style={[styles.rank, { backgroundColor: t.rankFill, borderBottomColor: t.plateBorder }]}>
        <View>
          <Text style={[styles.micro, { color: color.inkMuted }]}>{HISTORY.reputation.seasonRank}</Text>
          <View style={styles.rankFigure}>
            <Text style={[styles.rankNum, { color: color.ink }]}>{earned}</Text>
            <Text style={[styles.slash, { color: color.inkMuted }]}>/</Text>
            <Text style={[styles.rankNum, { color: color.ink }]}>{total}</Text>
          </View>
          <Text style={[styles.caption, { color: color.inkSecondary }]}>{next ? HISTORY.reputation.next(HISTORY.badges.names[next.id].name) : HISTORY.reputation.unlocked(earned, total)}</Text>
        </View>
        <Bar pct={progress} label={HISTORY.reputation.unlocked(earned, total)} />
      </View>
      <View style={styles.grid}>
        {badges.map((badge, index) => {
          const Icon = ICONS[badge.id] ?? BadgeCheck;
          const words = HISTORY.badges.names[badge.id];
          const state = badge.earned ? HISTORY.badges.unlocked : badge.pending === "earn" ? HISTORY.badges.pendingEarn : HISTORY.badges.locked;
          const ink = badge.earned ? color.accent : color.inkMuted;
          return (
            <View
              key={badge.id}
              accessible
              accessibilityLabel={`${words.name}, ${state}. ${words.description}`}
              style={[
                styles.card,
                badge.earned ? { borderColor: t.earnedBorder, backgroundColor: t.earnedFill } : { borderColor: t.plateBorder, backgroundColor: t.lockedFill, opacity: t.lockedOpacity },
              ]}
            >
              <View style={styles.cardHead}>
                <Text style={[styles.micro, { color: ink }]}>{String(index + 1).padStart(2, "0")}</Text>
                <Text style={[styles.micro, { color: ink }]}>{state}</Text>
              </View>
              <View style={[styles.icon, badge.earned ? { backgroundColor: t.iconFill, borderColor: t.iconBorder } : { borderColor: t.plateBorder }]}>
                <Icon size={16} color={ink} strokeWidth={1.9} />
              </View>
              <Text style={[styles.name, { color: color.ink }]}>{words.name}</Text>
              <Text style={[styles.caption, { color: color.inkSecondary }]}>{words.description}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** web's ReputationPanel: the tier, the record it rests on and the distance to the next one — then the badges. */
export function ReputationPanel({ reputation, badges }: { reputation: ReputationData; badges: readonly Badge[] }) {
  const { name, color } = useTheme();
  const t = profileTokens(name);
  const words = HISTORY.reputation;
  return (
    <View style={styles.panel}>
      <View style={[styles.plate, { backgroundColor: t.plate, borderColor: t.plateBorder }]}>
        <View style={styles.gap4}>
          <Text style={[styles.micro, { color: color.inkMuted }]}>{words.tier}</Text>
          <Text style={[styles.tier, { color: color.ink }]}>{words.tiers[reputation.tier]}</Text>
          <Text style={[styles.caption, { color: color.inkSecondary }]}>{words.record(reputation.bets, reputation.wins)}</Text>
        </View>
        <View style={styles.gap8}>
          <Text style={[styles.caption, { color: color.inkSecondary }]}>{reputation.nextTier ? words.next(words.tiers[reputation.nextTier]) : words.top}</Text>
          <Bar pct={reputation.progressToNext} label={words.progress(reputation.progressToNext)} />
          <Text style={[styles.caption, { color: color.inkMuted }]}>{words.rule}</Text>
        </View>
      </View>
      <BadgeGrid badges={badges} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 16 },
  plate: { gap: 16, padding: 16, borderWidth: 1, borderRadius: 12 },
  gap4: { gap: 4 },
  gap8: { gap: 8 },
  micro: { fontFamily: FONT.bodyMedium, fontSize: 11, lineHeight: 13.2, letterSpacing: 1.76, textTransform: "uppercase" },
  caption: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85 },
  tier: { fontFamily: FONT.headingHeavy, fontSize: 32, lineHeight: 32, letterSpacing: -0.96 },
  bar: { height: 6, borderRadius: 999, overflow: "hidden" },
  barFill: { height: "100%", minWidth: 6, borderRadius: 999 },
  display: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  rank: { gap: 20, minHeight: 128, padding: 20, justifyContent: "space-between", borderBottomWidth: 1 },
  rankFigure: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 8 },
  rankNum: { fontFamily: FONT.headingHeavy, fontSize: 48, lineHeight: 48 },
  slash: { fontFamily: FONT.headingHeavy, fontSize: 20, lineHeight: 20 },
  grid: { gap: 12, padding: 12 },
  card: { minHeight: 144, padding: 16, borderWidth: 1, borderRadius: 8 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 20 },
  icon: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  name: { fontFamily: FONT.bodyStrong, fontSize: 15, lineHeight: 23.25 },
});
