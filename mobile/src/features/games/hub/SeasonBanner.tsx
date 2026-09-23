import { formatSeasonCountdown, seasonRemainingMs } from "@agari/core/games";
import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNowMs } from "@/components/data/useNowMs";
import { GAMES } from "@/features/games/copy";
import type { SeasonView } from "@/features/games/duel/useSeason";
import { TrophyMark, useGames } from "~/features/games/shell";
import { FONT, useTheme } from "~/theme";

/**
 * web's `SeasonBanner` (Flicky's 3:1 strip): the pixel trophy, the season's name, its pool and countdown, from
 * the same facts the ladder prints. Tapping through opens the ladder. Only drawn when a season exists.
 */
export function SeasonBanner({ season }: { season: SeasonView }) {
  const { color } = useTheme();
  const { feedback } = useGames();
  const nowMs = useNowMs();
  const words = GAMES.rankPage;
  const remaining = nowMs === 0 ? null : seasonRemainingMs(season, nowMs);
  const pool = words.pool(String(season.prizePool.totalUnits), season.prizePool.currency);
  const clock = remaining === null ? "" : ` · ${remaining > 0 ? words.endsIn(formatSeasonCountdown(remaining)) : words.ended}`;
  return (
    <Pressable
      onPress={() => {
        feedback("tap");
        router.push("/games/rank" as Href);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${season.name}: ${pool}${clock}. ${GAMES.seasonBanner.cta}`}
      style={({ pressed }) => [
        styles.root,
        { backgroundColor: color.surface1, borderColor: color.accentDim },
        pressed && { opacity: 0.86 },
      ]}
    >
      <TrophyMark size={48} />
      <View style={styles.text}>
        <Text style={[styles.eyebrow, { color: color.inkMuted }]}>{GAMES.seasonBanner.eyebrow.toUpperCase()}</Text>
        <Text style={[styles.name, { color: color.ink }]} numberOfLines={1}>
          {season.name.toUpperCase()}
        </Text>
        <Text style={[styles.line, { color: color.accent }]} numberOfLines={1}>
          {`${pool}${clock}`.toUpperCase()}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 88,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  text: { flex: 1, gap: 2 },
  eyebrow: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 2.2 },
  name: { fontFamily: FONT.headingHeavy, fontSize: 22, letterSpacing: 0.6 },
  line: { fontFamily: FONT.data, fontSize: 11, letterSpacing: 1.2 },
});
