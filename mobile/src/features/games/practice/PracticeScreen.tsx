import { StyleSheet, Text, View } from "react-native";
import { PRACTICE } from "@/features/games/practice/copy";
import { PriceProbe } from "@/features/games/practice/PriceProbe";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { booleanCodec, usePersistedState } from "@/lib/persisted";
import { useGamesTokens } from "~/features/games/frame";
import { useGameScreen } from "~/features/games/shell";
import { StageHead, StageScroll, SwipeDeck } from "~/features/games/stage";
import { FONT } from "~/theme";
import { practiceStyles, PrLink, ReadinessPlate, ScoringNote, TutorialPlate } from "./PracticePanels";
import { PracticeResult } from "./PracticeResult";
import { PracticeWatch } from "./PracticeWatch";
import { usePracticeFace } from "./usePracticeFace";
import { usePracticeRound } from "./usePracticeRound";

const TUTORIAL_KEY = "agari.games.practiceSeen";

/**
 * web's `PracticeStage` (`/games/practice`): the duel's motion with nothing at risk. A stage, not a marketing page —
 * the eyebrow and the name (`.pr-head`), then the deck (or the watch, or the scoreboard), then the mode's sentence,
 * the honesty note, the first-run panel and the two links. The rail steps aside here, as on web. Nothing here reads
 * or writes a wallet: practice's economic kind is `none` and there is no submitter in it.
 */
export function PracticeScreen() {
  const { color } = useGamesTokens();
  const session = usePracticeRound();
  const market = useMarketSession();
  const [seen, setSeen, hydrated] = usePersistedState(TUTORIAL_KEY, false, booleanCodec);
  const renderFace = usePracticeFace(session);
  useGameScreen("practice");
  const { readiness, round, score } = session;

  return (
    <StageScroll>
      {session.assets.map((asset) => (
        <PriceProbe key={asset} asset={asset} onPrice={session.reportPrice} />
      ))}

      <StageHead eyebrow={PRACTICE.eyebrow} title={PRACTICE.title} />

      <View style={styles.layout}>
        <View>
          {readiness.kind === "ready" ? (
            score ? (
              <PracticeResult round={round} score={score} onAgain={session.deal} />
            ) : round.phase === "watching" ? (
              <PracticeWatch round={round} leftSec={session.watchLeftSec} priceOf={session.priceOf} />
            ) : (
              <SwipeDeck
                cards={round.cards}
                active={session.active}
                playedSide={session.playedSide}
                onPick={session.pick}
                refusal={session.active && !session.priceOf(session.active.asset) ? PRACTICE.card.noPrice : null}
                renderFace={renderFace}
              />
            )
          ) : (
            <ReadinessPlate readiness={readiness.kind} closedLabel={market && !market.open ? market.label : null} />
          )}
        </View>

        <View style={styles.side}>
          <Text style={[styles.intro, { color: color.inkSecondary }]}>{PRACTICE.intro}</Text>
          <ScoringNote />
          {hydrated && !seen ? <TutorialPlate onDismiss={() => setSeen(true)} /> : null}
          <View style={practiceStyles.actions}>
            <PrLink label={PRACTICE.restart} onPress={session.deal} disabled={readiness.kind !== "ready"} />
            {hydrated && seen ? <PrLink label={PRACTICE.tutorial.reopen} quiet onPress={() => setSeen(false)} /> : null}
          </View>
        </View>
      </View>
    </StageScroll>
  );
}

const styles = StyleSheet.create({
  layout: { gap: 16 },
  side: { gap: 12 },
  intro: { fontFamily: FONT.body, fontSize: 13, lineHeight: 21.45 },
});
