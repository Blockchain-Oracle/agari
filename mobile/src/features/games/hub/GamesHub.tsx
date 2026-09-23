import type { Href } from "expo-router";
import { useFocusEffect } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GAMES } from "@/features/games/copy";
import { SectionHeader } from "~/components/kit";
import { gameEntriesInGroup, useGames, useLastGame } from "~/features/games/shell";
import { preloadGameAudio } from "~/games/audio";
import { FONT, SPACE, TYPE, useTheme } from "~/theme";
import { AchievementsPlate } from "./AchievementsPlate";
import { GameCard } from "./GameCard";
import { LinkPlate } from "./LinkPlate";
import { MatchTile } from "./MatchTile";
import { ProfileCard } from "./ProfileCard";
import { SeasonBanner } from "./SeasonBanner";
import { useHubStatus } from "./useHubStatus";

const GROUPS = ["prediction", "duel", "arcade"] as const;

/**
 * web's `GamesHub` (`/games`): the season, the active match or the last game (resuming beats starting), every
 * mode in core's three groups with its live status and honest economic label, then the player's profile,
 * achievements, history and the ladder. Every fact is a read; nothing here is asserted.
 */
export function GamesHub() {
  const { color } = useTheme();
  const { activeMatchId, match, openSettings } = useGames();
  const last = useLastGame();
  const { season, status, presence } = useHubStatus();

  // The first swipe in any mode should not be silent while its sample decodes.
  useFocusEffect(useCallback(() => preloadGameAudio(), []));

  return (
    <ScrollView
      style={{ backgroundColor: color.ground }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.body}
    >
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={[styles.eyebrow, { color: color.accent }]}>{GAMES.eyebrow.toUpperCase()}</Text>
          <Text style={[TYPE.display, { color: color.ink }]} accessibilityRole="header">
            {GAMES.title}
            <Text style={{ color: color.accent }}>.</Text>
          </Text>
        </View>
        <Pressable
          onPress={openSettings}
          accessibilityRole="button"
          accessibilityLabel={GAMES.rail.settings}
          style={({ pressed }) => [styles.settings, { borderColor: color.hairline, backgroundColor: pressed ? color.surface2 : color.surface1 }]}
        >
          <SymbolView name={{ ios: "slider.horizontal.3", android: "tune" }} size={20} tintColor={color.ink} />
        </Pressable>
      </View>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>{GAMES.intro}</Text>

      {season ? <SeasonBanner season={season} /> : null}

      {activeMatchId ? (
        <MatchTile match={match} />
      ) : last ? (
        <LinkPlate
          tone="accent"
          title={GAMES.lastGame.title}
          body={GAMES.lastGame.body(last.name)}
          cta={GAMES.lastGame.cta}
          href={last.href as Href}
        />
      ) : null}

      {GROUPS.map((group) => {
        const head = GAMES.sections[group];
        return (
          <View key={group} style={styles.section} accessibilityLabel={head.title}>
            <SectionHeader index={head.number} title={head.title} desc={head.desc} />
            {gameEntriesInGroup(group).map((entry) => (
              <GameCard key={entry.id} entry={entry} status={status(entry)} presence={presence(entry)} />
            ))}
          </View>
        );
      })}

      <View style={styles.section}>
        <SectionHeader index={GAMES.sections.profile.number} title={GAMES.sections.profile.title} desc={GAMES.sections.profile.desc} />
        <ProfileCard />
        <AchievementsPlate />
      </View>

      <View style={styles.section}>
        <SectionHeader index={GAMES.sections.history.number} title={GAMES.sections.history.title} desc={GAMES.sections.history.desc} />
        <LinkPlate title={GAMES.historyPage.title} body={GAMES.history.body} cta={GAMES.history.cta} href={"/games/history" as Href} />
        <LinkPlate
          title={GAMES.rankPage.title}
          body={season ? GAMES.rankPage.introSeason : GAMES.rankPage.intro}
          cta={GAMES.rank.cta}
          href={"/games/rank" as Href}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: SPACE.gutter, paddingTop: 20, paddingBottom: 130, gap: 16 },
  hero: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  heroText: { flex: 1, gap: 6 },
  eyebrow: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 1.8 },
  settings: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  section: { gap: 12, marginTop: 8 },
});
