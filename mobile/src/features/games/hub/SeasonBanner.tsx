import { formatSeasonCountdown, seasonRemainingMs } from "@agari/core/games";
import { router, type Href } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect } from "react-native-svg";
import { Stop, stopPaint } from "~/components/ui/SvgStop";
import { useNowMs } from "@/components/data/useNowMs";
import { GAMES } from "@/features/games/copy";
import type { SeasonView } from "@/features/games/duel/useSeason";
import { Press, useGamesTokens } from "~/features/games/frame";
import { TrophyMark, useGames } from "~/features/games/shell";
import { PIXEL_FONT } from "~/theme/web/games";

/**
 * web's `SeasonBanner` (`.gm-season`, Flicky's 3:1 strip) at phone width: the glowing pixel trophy, the season's
 * name, pool and countdown in the pixel face over a vermilion wash that fades into surface-1 by 70 %. The
 * whole strip opens the ladder (`.gm-season-link`); the "see the ladder" cue is hidden below 480 px, as on web.
 */
export function SeasonBanner({ season }: { season: SeasonView }) {
  const { t, color } = useGamesTokens();
  const { feedback } = useGames();
  const nowMs = useNowMs();
  const words = GAMES.rankPage;
  const remaining = nowMs === 0 ? null : seasonRemainingMs(season, nowMs);
  const pool = words.pool(String(season.prizePool.totalUnits), season.prizePool.currency);
  const clock = remaining === null ? "" : ` · ${remaining > 0 ? words.endsIn(formatSeasonCountdown(remaining)) : words.ended}`;
  return (
    <Press
      onPress={() => {
        feedback("tap");
        router.push("/games/rank" as Href);
      }}
      accessibilityRole="link"
      accessibilityLabel={`${season.name}: ${pool}${clock}`}
      style={[styles.link, styles.season, { borderColor: t.seasonBorder, backgroundColor: color.surface1 }]}
    >
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="gm-season" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" {...stopPaint(t.seasonWash)} />
            <Stop offset="0.7" {...stopPaint(color.surface1)} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#gm-season)" />
      </Svg>
      <View pointerEvents="none" style={[styles.lipTop, { backgroundColor: t.seasonLipTop }]} />
      <View pointerEvents="none" style={[styles.lipBottom, { backgroundColor: t.seasonLipBottom }]} />
      <View style={[styles.trophy, { shadowColor: t.trophyGlow }]}>
        <TrophyMark size={44} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.eyebrow, { color: color.inkMuted }]}>{GAMES.seasonBanner.eyebrow.toUpperCase()}</Text>
        <Text style={[styles.name, { color: color.ink }]} numberOfLines={1}>
          {season.name.toUpperCase()}
        </Text>
        <Text style={[styles.line, { color: color.accent }]} numberOfLines={1}>
          {`${pool}${clock}`.toUpperCase()}
        </Text>
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  link: { marginBottom: 20 },
  season: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 96, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  lipTop: { position: "absolute", top: 0, left: 0, right: 0, height: 2 },
  lipBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 2 },
  trophy: { shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  text: { flex: 1, minWidth: 0, gap: 2 },
  eyebrow: { fontFamily: PIXEL_FONT, fontSize: 11, lineHeight: 13, letterSpacing: 2.42 },
  name: { fontFamily: PIXEL_FONT, fontSize: 22, lineHeight: 22, letterSpacing: 1.32 },
  line: { fontFamily: PIXEL_FONT, fontSize: 14, lineHeight: 17, letterSpacing: 1.68, fontVariant: ["tabular-nums"] },
});
