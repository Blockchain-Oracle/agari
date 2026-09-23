import { useHeaderHeight } from "expo-router/react-navigation";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { PRACTICE } from "@/features/games/practice/copy";
import { PriceProbe } from "@/features/games/practice/PriceProbe";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { booleanCodec, usePersistedState } from "@/lib/persisted";
import { Button, Screen } from "~/components/kit";
import { GameHeaderActions, useGameScreen } from "~/features/games/shell";
import { SwipeDeck } from "~/features/games/stage";
import { FONT, SPACE, useTheme } from "~/theme";
import { ReadinessPlate, ScoringNote, TutorialPlate } from "./PracticePanels";
import { PracticeResult } from "./PracticeResult";
import { PracticeWatch } from "./PracticeWatch";
import { usePracticeFace } from "./usePracticeFace";
import { usePracticeRound } from "./usePracticeRound";

const TUTORIAL_KEY = "agari.games.practiceSeen";

/**
 * web's `PracticeStage` (`/games/practice`): the duel's motion with nothing at risk. The shared SwipeDeck over
 * a face with one real number, the watch, the scoreboard. While a card is up the stage is a fixed layout (the
 * drag is vertical); the other phases scroll. Nothing here reads or writes a wallet: practice's economic kind
 * is `none` and there is no submitter in it.
 */
export function PracticeScreen() {
  const { color } = useTheme();
  const headerHeight = useHeaderHeight();
  const session = usePracticeRound();
  const market = useMarketSession();
  const [seen, setSeen, hydrated] = usePersistedState(TUTORIAL_KEY, false, booleanCodec);
  const renderFace = usePracticeFace(session);
  useGameScreen("practice");

  const { readiness, round, score } = session;
  const picking = readiness.kind === "ready" && !score && round.phase !== "watching";
  const tutorial = hydrated && !seen;

  const probes = session.assets.map((asset) => <PriceProbe key={asset} asset={asset} onPrice={session.reportPrice} />);
  const eyebrow = <Text style={[styles.eyebrow, { color: color.accent }]}>{PRACTICE.eyebrow.toUpperCase()}</Text>;
  const actions = (
    <View style={styles.actions}>
      <Button label={PRACTICE.restart} variant="secondary" size="sm" block={false} disabled={readiness.kind !== "ready"} onPress={session.deal} style={styles.action} />
      {hydrated && seen ? (
        <Button label={PRACTICE.tutorial.reopen} variant="ghost" size="sm" block={false} onPress={() => setSeen(false)} style={styles.action} />
      ) : null}
    </View>
  );

  return (
    <Screen title={PRACTICE.title} scroll={false} headerRight={() => <GameHeaderActions id="practice" />}>
      {probes}
      {picking && !tutorial ? (
        <View style={[styles.stage, { paddingTop: headerHeight + 6 }]}>
          {eyebrow}
          <SwipeDeck
            cards={round.cards}
            active={session.active}
            playedSide={session.playedSide}
            onPick={session.pick}
            refusal={session.active && !session.priceOf(session.active.asset) ? PRACTICE.card.noPrice : null}
            renderFace={renderFace}
          />
          {actions}
        </View>
      ) : (
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.body}>
          {eyebrow}
          <Text style={[styles.intro, { color: color.inkSecondary }]}>{PRACTICE.intro}</Text>
          {tutorial ? <TutorialPlate onDismiss={() => setSeen(true)} /> : null}
          {readiness.kind !== "ready" ? (
            <ReadinessPlate readiness={readiness.kind} closedLabel={market && !market.open ? market.label : null} />
          ) : score ? (
            <PracticeResult round={round} score={score} onAgain={session.deal} />
          ) : round.phase === "watching" ? (
            <PracticeWatch round={round} leftSec={session.watchLeftSec} priceOf={session.priceOf} />
          ) : null}
          <ScoringNote />
          {actions}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, paddingHorizontal: SPACE.gutter, paddingBottom: 96, gap: 10 },
  body: { padding: SPACE.gutter, paddingTop: 12, paddingBottom: 120, gap: 16 },
  eyebrow: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 1.6 },
  intro: { fontFamily: FONT.body, fontSize: 15, lineHeight: 23 },
  actions: { flexDirection: "row", justifyContent: "center", gap: 8 },
  action: { minWidth: 120 },
});
