import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { GAMES } from "@/features/games/copy";
import { GamesPage, PageHero, Plate, PlateBody, PlateTitle, ResumeCta, SectionHead } from "~/features/games/frame";
import { gameEntriesInGroup, useGames, useLastGame } from "~/features/games/shell";
import { preloadGameAudio } from "~/games/audio";
import { AchievementsPlate } from "./AchievementsPlate";
import { GameCard } from "./GameCard";
import { MatchTile } from "./MatchTile";
import { ProfileCard } from "./ProfileCard";
import { SeasonBanner } from "./SeasonBanner";
import { useHubStatus } from "./useHubStatus";

const GROUPS = ["prediction", "duel", "arcade"] as const;

/**
 * web's `GamesHub` (`/games`): the "Games." hero, the season banner, the active match or the last game (resuming
 * beats starting), every mode in core's three groups with its live status and honest economic label, then the
 * player's profile and achievements, and the two link plates to history and the ladder.
 */
export function GamesHub() {
  const { activeMatchId, match, feedback } = useGames();
  const last = useLastGame();
  const { season, status, presence } = useHubStatus();
  // The first swipe in any mode should not be silent while its sample decodes.
  useFocusEffect(useCallback(() => preloadGameAudio(), []));
  const go = (href: string) => () => {
    feedback("tap");
    router.push(href as Href);
  };

  return (
    <GamesPage>
      <PageHero eyebrow={GAMES.eyebrow} title={GAMES.title} intro={GAMES.intro} />

      {season ? <SeasonBanner season={season} /> : null}

      {activeMatchId ? (
        <MatchTile match={match} />
      ) : last ? (
        <Plate resume onPress={go(last.href)} style={styles.last} accessibilityLabel={GAMES.lastGame.title}>
          <PlateTitle>{GAMES.lastGame.title}</PlateTitle>
          <PlateBody>{GAMES.lastGame.body(last.name)}</PlateBody>
          <ResumeCta>{GAMES.lastGame.cta}</ResumeCta>
        </Plate>
      ) : null}

      {GROUPS.map((group) => {
        const head = GAMES.sections[group];
        return (
          <View key={group} style={styles.section} accessibilityLabel={head.title}>
            <SectionHead number={head.number} title={head.title} desc={head.desc} />
            <View style={styles.grid}>
              {gameEntriesInGroup(group).map((entry) => (
                <GameCard key={entry.id} entry={entry} status={status(entry)} presence={presence(entry)} />
              ))}
            </View>
          </View>
        );
      })}

      <View style={styles.section} accessibilityLabel={GAMES.sections.profile.title}>
        <SectionHead {...GAMES.sections.profile} />
        <View style={styles.grid}>
          <ProfileCard />
          <AchievementsPlate />
        </View>
      </View>

      <View style={styles.section} accessibilityLabel={GAMES.sections.history.title}>
        <SectionHead {...GAMES.sections.history} />
        <View style={styles.grid}>
          <Plate onPress={go("/games/history")} accessibilityLabel={GAMES.historyPage.title}>
            <PlateTitle>{GAMES.historyPage.title}</PlateTitle>
            <PlateBody>{GAMES.history.body}</PlateBody>
            <ResumeCta>{GAMES.history.cta}</ResumeCta>
          </Plate>
          <Plate onPress={go("/games/rank")} accessibilityLabel={GAMES.rankPage.title}>
            <PlateTitle>{GAMES.rankPage.title}</PlateTitle>
            <PlateBody>{season ? GAMES.rankPage.introSeason : GAMES.rankPage.intro}</PlateBody>
            <ResumeCta>{GAMES.rank.cta}</ResumeCta>
          </Plate>
        </View>
      </View>
    </GamesPage>
  );
}

const styles = StyleSheet.create({
  last: { marginBottom: 32 },
  section: { marginBottom: 32 },
  grid: { gap: 12 },
});
