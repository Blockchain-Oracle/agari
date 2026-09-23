import { achievementsEarned, type Achievement } from "@agari/core/games";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GAMES } from "@/features/games/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { Skeleton } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

interface Shelf {
  configured: boolean;
  achievements: readonly Achievement[];
  earned: number;
}

/**
 * web's `AchievementsPlate`: what this wallet has earned from settled records, and what the rest take. A
 * locked badge names what it takes at lower contrast rather than hiding; progress shows where `need > 1`.
 * Read from web's `/api/games/achievements`, the same shelf the site shows.
 */
// 21st: trophyso/achievement-card
export function AchievementsPlate() {
  const { color } = useTheme();
  const { address } = useWalletSession();
  const [shelf, setShelf] = useState<Shelf | null>(null);

  useEffect(() => {
    let live = true;
    const url = address ? `/api/games/achievements?wallet=${address}` : "/api/games/achievements";
    fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<Shelf>) : null))
      .then((next) => {
        if (live && next) setShelf(next);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [address]);

  const list = shelf?.achievements ?? [];
  const earned = shelf ? achievementsEarned(list) : 0;
  const words = GAMES.achievements;
  const body = shelf?.configured === false ? words.noStore : address ? words.body : words.connect;

  return (
    <View style={[styles.plate, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={[TYPE.title, { color: color.ink }]}>{words.title}</Text>
          {list.length > 0 ? <Text style={[TYPE.data, { color: color.accent }]}>{words.count(earned, list.length)}</Text> : null}
        </View>
        {shelf ? (
          <Text style={[TYPE.dataHero, { color: earned > 0 ? color.ink : color.inkMuted }]} accessibilityLabel={`${earned} earned`}>
            {earned}
          </Text>
        ) : (
          <Skeleton width={40} height={40} />
        )}
      </View>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{body}</Text>
      {shelf === null ? <Skeleton height={120} /> : null}
      <View style={styles.grid}>
        {list.map((badge) => (
          <Badge key={badge.id} badge={badge} />
        ))}
      </View>
    </View>
  );
}

function Badge({ badge }: { badge: Achievement }) {
  const { color } = useTheme();
  const on = badge.earned;
  const progress = badge.need > 0 ? Math.min(1, badge.have / badge.need) : 0;
  return (
    <View
      style={[styles.badge, { borderColor: on ? color.accentDim : color.hairline, backgroundColor: on ? color.accentWash : color.surface2 }]}
      accessible
      accessibilityLabel={`${badge.title}, ${on ? "earned" : "locked"}. ${badge.how}.${badge.need > 1 && !on ? ` ${badge.have} of ${badge.need}.` : ""}`}
    >
      <View style={styles.badgeHead}>
        <SymbolView
          name={on ? { ios: "rosette", android: "military_tech" } : { ios: "lock.fill", android: "lock" }}
          size={14}
          tintColor={on ? color.accent : color.inkMuted}
        />
        <Text style={[styles.badgeTitle, { color: on ? color.ink : color.inkSecondary }]} numberOfLines={1}>
          {badge.title}
        </Text>
      </View>
      <Text style={[styles.how, { color: color.inkMuted }]}>{badge.how}</Text>
      {badge.need > 1 && !on ? (
        <View style={styles.progressRow}>
          <View style={[styles.track, { backgroundColor: color.hairline }]}>
            <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: color.accent }]} />
          </View>
          <Text style={[styles.count, { color: color.accent }]}>
            {badge.have} / {badge.need}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 16, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  headText: { flex: 1, gap: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: { flexGrow: 1, flexBasis: "46%", borderWidth: 1, borderRadius: RADIUS.md, padding: 10, gap: 4 },
  badgeHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  badgeTitle: { flex: 1, fontFamily: FONT.heading, fontSize: 12.5 },
  how: { fontFamily: FONT.body, fontSize: 11.5, lineHeight: 16 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  track: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%" },
  count: { fontFamily: FONT.data, fontSize: 10.5 },
});
